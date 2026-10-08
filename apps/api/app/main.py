import hashlib
import hmac
import json
import logging
import os
import secrets
import smtplib
import ssl
from datetime import date, datetime, timedelta, timezone
from email.message import EmailMessage
from enum import Enum
from functools import lru_cache
from pathlib import Path
from typing import Literal

import httpx
import jwt
from dotenv import dotenv_values, load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from openai import APIConnectionError, APIStatusError, APITimeoutError, OpenAI
from pydantic import BaseModel, EmailStr, Field, ValidationError
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError

BACKEND_ENV_PATH = Path(__file__).resolve().parents[1] / ".env"
load_dotenv(BACKEND_ENV_PATH)
load_dotenv(Path(__file__).resolve().parents[3] / ".env")
app = FastAPI(title="MedSafe API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("FRONTEND_ORIGINS", "http://localhost:3000,http://localhost:3001,http://localhost:3002").split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

JWT_ALGORITHM = "HS256"
JWT_TTL_MINUTES = 60
MAX_PRESCRIPTION_SIZE = 10 * 1024 * 1024
MAX_OCR_TEXT_LENGTH = 30_000
OCR_SPACE_URL = "https://api.ocr.space/parse/image"
GROQ_BASE_URL = "https://api.groq.com/openai/v1"
GROQ_MODEL = "openai/gpt-oss-20b"
PRESCRIPTION_FILENAMES = {
    "image/jpeg": "prescription.jpg",
    "image/png": "prescription.png",
    "application/pdf": "prescription.pdf",
}


@lru_cache(maxsize=1)
def get_database():
    uri = os.getenv("MONGODB_URI")
    database_name = os.getenv("MONGODB_DATABASE", "medsafe")
    if not uri:
        raise HTTPException(status_code=503, detail="MONGODB_URI is not configured.")
    try:
        client = MongoClient(uri, serverSelectionTimeoutMS=5000, connectTimeoutMS=5000)
        client.admin.command("ping")
        database = client[database_name]
        database.users.create_index("email", unique=True)
        database.password_resets.create_index("expires_at", expireAfterSeconds=0)
        database.password_resets.create_index([("email", 1), ("requested_at", -1)])
        return database
    except PyMongoError as error:
        raise HTTPException(status_code=503, detail="Unable to connect to MongoDB.") from error


def password_digest(password: str, salt: str | None = None) -> str:
    actual_salt = salt or secrets.token_hex(16)
    digest = hashlib.scrypt(password.encode(), salt=bytes.fromhex(actual_salt), n=2**14, r=8, p=1)
    return f"{actual_salt}${digest.hex()}"


def password_matches(password: str, stored: str) -> bool:
    salt, expected = stored.split("$", 1)
    return secrets.compare_digest(password_digest(password, salt).split("$", 1)[1], expected)


def issue_token(user_id: str, email: str) -> str:
    now = datetime.now(timezone.utc)
    return jwt.encode({"sub": user_id, "email": email, "iat": now, "exp": now + timedelta(minutes=JWT_TTL_MINUTES)}, os.getenv("JWT_SECRET", "development-only-change-me"), algorithm=JWT_ALGORITHM)


class AuthRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str = Field(min_length=20)
    password: str = Field(min_length=8, max_length=128)


class OtpResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str = Field(pattern=r"^\d{6}$")
    password: str = Field(min_length=8, max_length=128)


class AuthResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    email: EmailStr


class Severity(str, Enum):
    safe = "Safe"
    monitor = "Monitor"
    moderate = "Moderate"
    high = "High"
    critical = "Critical"


class Medicine(BaseModel):
    canonical_name: str
    generic_name: str
    rxcui: str = Field(description="Demo identifiers are prefixed with DEMO.")
    strength: str
    dosage_form: str = "tablet"
    confidence: int = Field(ge=0, le=100)


class Interaction(BaseModel):
    id: str
    type: Literal["medicine-medicine", "medicine-food"]
    drug_a: str
    drug_b: str | None = None
    food: str | None = None
    severity: Severity
    mechanism: str
    patient_message: str
    clinical_message: str
    evidence: str
    last_verified: date
    recommendation: str
    requires_clinician_review: bool = True


class CheckRequest(BaseModel):
    medicines: list[str]
    foods: list[str] = []


class PrescriptionMedicineAnalysis(BaseModel):
    medicine_name: str = Field(min_length=1)
    strength: str | None = None
    dosage: str | None = None
    frequency: str | None = None
    timing: str | None = None
    duration: str | None = None
    instructions: str | None = None


class PrescriptionAnalysis(BaseModel):
    medicines: list[PrescriptionMedicineAnalysis] = Field(default_factory=list)
    side_effects: list[str] = Field(default_factory=list)
    drug_drug_interactions: list[str] = Field(default_factory=list)
    drug_food_interactions: list[str] = Field(default_factory=list)
    warnings: list[str] = Field(default_factory=list)


INTERACTIONS = [
    Interaction(
        id="demo-warfarin-aspirin",
        type="medicine-medicine",
        drug_a="Warfarin",
        drug_b="Aspirin",
        severity=Severity.high,
        mechanism="Anticoagulant and antiplatelet effects may be additive.",
        patient_message="Taking these medicines together can increase the chance of bleeding.",
        clinical_message="Concurrent anticoagulant and antiplatelet therapy may increase bleeding risk. Assess clinical appropriateness against indication and patient-specific risk factors.",
        evidence="Demo interaction — replace with a validated source before clinical use.",
        last_verified=date(2026, 10, 7),
        recommendation="Do not stop either medicine on your own. Contact your doctor or pharmacist.",
    ),
    Interaction(
        id="demo-warfarin-leafy-greens",
        type="medicine-food",
        drug_a="Warfarin",
        food="leafy greens",
        severity=Severity.moderate,
        mechanism="Vitamin K intake can affect warfarin treatment effect.",
        patient_message="Large changes in leafy green intake may affect how well warfarin works.",
        clinical_message="Counsel on consistency of vitamin K intake and assess INR monitoring requirements.",
        evidence="Demo interaction — replace with a validated source before clinical use.",
        last_verified=date(2026, 10, 7),
        recommendation="Keep intake consistent and discuss major diet changes with your clinician.",
    ),
]


def extract_prescription_text(image: bytes, content_type: str) -> str:
    api_key = provider_api_key("OCR_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="OCR_API_KEY is not configured in the backend .env file.")

    try:
        with httpx.Client(timeout=httpx.Timeout(60.0, connect=10.0)) as client:
            response = client.post(
                OCR_SPACE_URL,
                headers={"apikey": api_key},
                data={"language": "eng", "isOverlayRequired": "false"},
                files={"file": (PRESCRIPTION_FILENAMES[content_type], image, content_type)},
            )
            response.raise_for_status()
            payload = response.json()
    except httpx.TimeoutException as error:
        logging.warning("OCR.space request timed out.")
        raise HTTPException(status_code=504, detail="The OCR service took too long. Please try again.") from error
    except httpx.HTTPStatusError as error:
        logging.warning("OCR.space returned HTTP status %s.", error.response.status_code)
        detail = provider_error_detail(error.response, "OCR.space", "could not process this prescription")
        raise HTTPException(status_code=502, detail=detail) from error
    except httpx.RequestError as error:
        logging.warning("Could not reach OCR.space.")
        raise HTTPException(status_code=502, detail="The OCR service is temporarily unavailable. Please try again.") from error
    except ValueError as error:
        logging.warning("OCR.space returned an invalid response.")
        raise HTTPException(status_code=502, detail="The OCR service returned an invalid response.") from error

    if not isinstance(payload, dict):
        raise HTTPException(status_code=502, detail="The OCR service returned an invalid response.")
    if payload.get("IsErroredOnProcessing"):
        provider_message = payload.get("ErrorMessage")
        if isinstance(provider_message, list):
            provider_message = "; ".join(str(message) for message in provider_message)
        if isinstance(provider_message, str) and provider_message.strip():
            raise HTTPException(
                status_code=422,
                detail=f"OCR.space could not read this file: {provider_message[:240]}",
            )
        raise HTTPException(status_code=422, detail="The OCR service could not read this file. Try a clearer image.")
    parsed_results = payload.get("ParsedResults")
    if not isinstance(parsed_results, list):
        raise HTTPException(status_code=502, detail="The OCR service returned an invalid response.")
    return "\n".join(
        result.get("ParsedText", "").strip()
        for result in parsed_results
        if isinstance(result, dict) and isinstance(result.get("ParsedText"), str)
    ).strip()


def analyze_prescription_text(ocr_text: str) -> PrescriptionAnalysis:
    api_key = provider_api_key("GROQ_API_KEY")
    if not api_key:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY is not configured in the backend .env file.")

    system_prompt = (
        "You help a patient understand text transcribed from a prescription. "
        "Return only valid JSON matching the requested fields. Extract medicine details "
        "only when supported by the text; use null for unknown medicine details and empty "
        "arrays when no information is available. Do not guess. Interaction and side-effect "
        "information is general and unverified; include uncertainty in warnings."
    )
    requested_shape = {
        "medicines": [{
            "medicine_name": "string",
            "strength": "string or null",
            "dosage": "string or null",
            "frequency": "string or null",
            "timing": "string or null",
            "duration": "string or null",
            "instructions": "string or null",
        }],
        "side_effects": ["string"],
        "drug_drug_interactions": ["string"],
        "drug_food_interactions": ["string"],
        "warnings": ["string"],
    }
    try:
        client = OpenAI(
            api_key=api_key,
            base_url=GROQ_BASE_URL,
            timeout=45.0,
            max_retries=0,
        )
        response = client.responses.create(
            model=GROQ_MODEL,
            instructions=system_prompt,
            input=(
                f"Analyze this OCR text and return only JSON with this shape: "
                f"{json.dumps(requested_shape)}\n\nOCR text:\n{ocr_text}"
            ),
        )
        content = response.output_text
    except APITimeoutError as error:
        logging.warning("Groq API request timed out.")
        raise HTTPException(status_code=504, detail="The analysis service took too long. Please try again.") from error
    except APIStatusError as error:
        logging.warning("Groq API returned HTTP status %s.", error.status_code)
        detail = provider_error_detail(error.response, "Groq", "could not analyze this prescription")
        raise HTTPException(status_code=502, detail=detail) from error
    except APIConnectionError as error:
        logging.warning("Could not reach the Groq API.")
        raise HTTPException(status_code=502, detail="The analysis service is temporarily unavailable. Please try again.") from error
    try:
        if not isinstance(content, str):
            raise ValueError("The model response content was not text.")
        return PrescriptionAnalysis.model_validate(json.loads(content))
    except (KeyError, IndexError, TypeError, ValueError, ValidationError) as error:
        logging.warning("Groq API returned analysis that did not match the expected structure.")
        raise HTTPException(status_code=502, detail="The analysis service returned an invalid result. Please try again.") from error


def provider_error_detail(response: httpx.Response, provider: str, fallback: str) -> str:
    message = ""
    try:
        payload = response.json()
    except ValueError:
        payload = None

    if isinstance(payload, dict):
        error = payload.get("error")
        if isinstance(error, dict):
            message = error.get("message", "") if isinstance(error.get("message"), str) else ""
        elif isinstance(error, str):
            message = error
        if not message and isinstance(payload.get("message"), str):
            message = payload["message"]

    summary = message.strip().replace("\n", " ")[:240]
    if summary:
        return f"{provider} request failed (HTTP {response.status_code}): {summary}"
    return f"{provider} request failed (HTTP {response.status_code}) and {fallback}."


def provider_api_key(name: str) -> str:
    return dotenv_values(BACKEND_ENV_PATH).get(name, "").strip()


@app.get("/")
def root() -> dict[str, str]:
    return {
        "name": "MedSafe API",
        "status": "running",
        "health": "/api/health",
        "docs": "/docs",
    }


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "environment": os.getenv("APP_ENV", "development")}


@app.post("/api/prescription/analyze")
def analyze_prescription(file: UploadFile = File(...)) -> dict[str, object]:
    content_type = file.content_type or ""
    signatures = {
        "image/jpeg": lambda content: content.startswith(b"\xff\xd8\xff"),
        "image/png": lambda content: content.startswith(b"\x89PNG\r\n\x1a\n"),
        "application/pdf": lambda content: content.startswith(b"%PDF-"),
    }
    signature_check = signatures.get(content_type)
    if signature_check is None:
        raise HTTPException(status_code=415, detail="Upload a JPG, PNG, or PDF prescription.")

    image = file.file.read(MAX_PRESCRIPTION_SIZE + 1)
    if not image:
        raise HTTPException(status_code=400, detail="The uploaded prescription is empty.")
    if len(image) > MAX_PRESCRIPTION_SIZE:
        raise HTTPException(status_code=413, detail="The prescription file must be 10 MB or smaller.")
    if not signature_check(image):
        raise HTTPException(status_code=415, detail="The file contents do not match a supported prescription format.")

    if not provider_api_key("OCR_API_KEY"):
        raise HTTPException(status_code=503, detail="OCR_API_KEY is not configured in the backend .env file.")
    if not provider_api_key("GROQ_API_KEY"):
        raise HTTPException(status_code=503, detail="GROQ_API_KEY is not configured in the backend .env file.")

    ocr_text = extract_prescription_text(image, content_type)
    if not ocr_text.strip():
        raise HTTPException(status_code=422, detail="No prescription text could be read. Try a clearer image.")
    if len(ocr_text) > MAX_OCR_TEXT_LENGTH:
        raise HTTPException(status_code=422, detail="The extracted text is too long to analyze safely.")
    analysis = analyze_prescription_text(ocr_text)
    return {"ocr_text": ocr_text, "analysis": analysis.model_dump()}


@app.post("/api/auth/signup", response_model=AuthResponse, status_code=201)
def signup(request: AuthRequest) -> AuthResponse:
    database = get_database()
    email = str(request.email).lower()
    try:
        result = database.users.insert_one({"email": email, "password_hash": password_digest(request.password), "created_at": datetime.now(timezone.utc)})
    except DuplicateKeyError as error:
        raise HTTPException(status_code=409, detail="An account with this email already exists.") from error
    return AuthResponse(access_token=issue_token(str(result.inserted_id), email), email=email)


@app.post("/api/auth/login", response_model=AuthResponse)
def login(request: AuthRequest) -> AuthResponse:
    database = get_database()
    email = str(request.email).lower()
    user = database.users.find_one({"email": email})
    if not user or not password_matches(request.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password.")
    return AuthResponse(access_token=issue_token(str(user["_id"]), email), email=email)


@app.post("/api/auth/forgot-password")
def forgot_password(request: ForgotPasswordRequest) -> dict[str, str]:
    smtp_host = os.getenv("SMTP_HOST")
    sender = os.getenv("SMTP_FROM_EMAIL")
    if not smtp_host or not sender:
        raise HTTPException(status_code=503, detail="Email delivery is not configured. Set SMTP_HOST and SMTP_FROM_EMAIL in the project .env file.")
    try:
        smtp_port = int(os.getenv("SMTP_PORT", "587"))
    except ValueError as error:
        raise HTTPException(status_code=503, detail="SMTP_PORT must be a valid port number.") from error
    if not 1 <= smtp_port <= 65535:
        raise HTTPException(status_code=503, detail="SMTP_PORT must be between 1 and 65535.")
    smtp_username = os.getenv("SMTP_USERNAME")
    smtp_password = os.getenv("SMTP_PASSWORD")
    if bool(smtp_username) != bool(smtp_password):
        raise HTTPException(status_code=503, detail="Set both SMTP_USERNAME and SMTP_PASSWORD, or leave both blank for an unauthenticated mail relay.")
    jwt_secret = os.getenv("JWT_SECRET")
    if not jwt_secret or len(jwt_secret) < 32:
        raise HTTPException(status_code=503, detail="JWT_SECRET must be configured with at least 32 characters before sending reset codes.")

    database = get_database()
    email = str(request.email).lower()
    response = {"message": "If an account exists, password reset instructions will be sent."}
    now = datetime.now(timezone.utc)
    recent_request = database.password_resets.find_one({
        "email": email,
        "purpose": "email_otp",
        "requested_at": {"$gt": now - timedelta(seconds=60)}
    })
    if recent_request:
        return response

    user = database.users.find_one({"email": email})
    if not user:
        return response

    otp = f"{secrets.randbelow(1_000_000):06d}"
    otp_hash = hmac.new(jwt_secret.encode(), f"{email}:{otp}".encode(), hashlib.sha256).hexdigest()
    database.password_resets.delete_many({"user_id": user["_id"]})
    reset_record = {
        "user_id": user["_id"],
        "email": email,
        "purpose": "email_otp",
        "otp_hash": otp_hash,
        "attempts": 0,
        "requested_at": now,
        "expires_at": now + timedelta(minutes=10)
    }
    inserted = database.password_resets.insert_one(reset_record)

    message = EmailMessage()
    message["Subject"] = "Your MedSafe password reset code"
    message["From"] = sender
    message["To"] = email
    message.set_content(
        f"Your MedSafe password reset code is {otp}.\n\n"
        "This code expires in 10 minutes and can only be used once. "
        "If you did not request a password reset, you can ignore this email."
    )
    use_ssl = os.getenv("SMTP_USE_SSL", "false").strip().casefold() in {"1", "true", "yes"}
    try:
        if use_ssl:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, timeout=10, context=ssl.create_default_context()) as server:
                if smtp_username:
                    server.login(smtp_username, smtp_password or "")
                server.send_message(message)
        else:
            with smtplib.SMTP(smtp_host, smtp_port, timeout=10) as server:
                server.ehlo()
                server.starttls(context=ssl.create_default_context())
                server.ehlo()
                if smtp_username:
                    server.login(smtp_username, smtp_password or "")
                server.send_message(message)
    except (OSError, smtplib.SMTPException) as error:
        database.password_resets.delete_one({"_id": inserted.inserted_id})
        logging.exception("Failed to deliver a password reset email.")
        raise HTTPException(status_code=503, detail="Could not send the reset email. Check the SMTP settings and try again.") from error
    return response


@app.post("/api/auth/reset-password/otp")
def reset_password_with_otp(request: OtpResetPasswordRequest) -> dict[str, str]:
    jwt_secret = os.getenv("JWT_SECRET")
    if not jwt_secret or len(jwt_secret) < 32:
        raise HTTPException(status_code=503, detail="JWT_SECRET must be configured with at least 32 characters before verifying reset codes.")

    database = get_database()
    email = str(request.email).lower()
    now = datetime.now(timezone.utc)
    reset = database.password_resets.find_one({
        "email": email,
        "purpose": "email_otp",
        "expires_at": {"$gt": now}
    })
    if not reset:
        raise HTTPException(status_code=400, detail="This code is invalid or expired. Request a new code.")
    if reset.get("attempts", 0) >= 5:
        raise HTTPException(status_code=429, detail="Too many incorrect codes. Request a new reset code.")

    expected_hash = hmac.new(jwt_secret.encode(), f"{email}:{request.otp}".encode(), hashlib.sha256).hexdigest()
    if not secrets.compare_digest(expected_hash, reset["otp_hash"]):
        database.password_resets.update_one({"_id": reset["_id"]}, {"$inc": {"attempts": 1}})
        raise HTTPException(status_code=400, detail="This code is invalid or expired. Check the code and try again.")

    consumed = database.password_resets.find_one_and_delete({
        "_id": reset["_id"],
        "otp_hash": expected_hash,
        "attempts": {"$lt": 5},
        "expires_at": {"$gt": now}
    })
    if not consumed:
        raise HTTPException(status_code=400, detail="This code is invalid or expired. Request a new code.")
    updated = database.users.update_one(
        {"_id": reset["user_id"]},
        {"$set": {"password_hash": password_digest(request.password)}}
    )
    if updated.matched_count != 1:
        raise HTTPException(status_code=400, detail="The account for this reset code could not be found.")
    database.password_resets.delete_many({"user_id": reset["user_id"]})
    return {"message": "Password updated. You can now sign in."}


@app.post("/api/auth/reset-password")
def reset_password(request: ResetPasswordRequest) -> dict[str, str]:
    database = get_database()
    token_hash = hashlib.sha256(request.token.encode()).hexdigest()
    reset = database.password_resets.find_one({"token_hash": token_hash, "expires_at": {"$gt": datetime.now(timezone.utc)}})
    if not reset:
        raise HTTPException(status_code=400, detail="This reset link is invalid or expired.")
    database.users.update_one({"_id": reset["user_id"]}, {"$set": {"password_hash": password_digest(request.password)}})
    database.password_resets.delete_many({"user_id": reset["user_id"]})
    return {"message": "Password updated. You can now sign in."}


@app.post("/api/interactions/check", response_model=list[Interaction])
def check_interactions(request: CheckRequest) -> list[Interaction]:
    names = {medicine.casefold() for medicine in request.medicines}
    foods = {food.casefold() for food in request.foods}
    matches: list[Interaction] = []
    for interaction in INTERACTIONS:
        if interaction.type == "medicine-medicine" and {interaction.drug_a.casefold(), (interaction.drug_b or "").casefold()} <= names:
            matches.append(interaction)
        if interaction.type == "medicine-food" and interaction.drug_a.casefold() in names and (interaction.food or "").casefold() in foods:
            matches.append(interaction)
    return matches


@app.get("/api/interactions/{interaction_id}", response_model=Interaction)
def get_interaction(interaction_id: str) -> Interaction:
    for interaction in INTERACTIONS:
        if interaction.id == interaction_id:
            return interaction
    from fastapi import HTTPException
    raise HTTPException(status_code=404, detail="Interaction not found in demo dataset.")


@app.get("/api/graph")
def graph() -> dict[str, object]:
    return {
        "demo": True,
        "nodes": [
            {"id": "warfarin", "label": "Warfarin", "kind": "medicine"},
            {"id": "aspirin", "label": "Aspirin", "kind": "medicine"},
            {"id": "bleeding", "label": "Increased bleeding risk", "kind": "outcome"},
        ],
        "edges": [{"source": "warfarin", "target": "aspirin", "label": "high interaction"}, {"source": "aspirin", "target": "bleeding", "label": "can increase"}],
    }
