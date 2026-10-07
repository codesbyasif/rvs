import hashlib
import os
import secrets
from datetime import date, datetime, timedelta, timezone
from enum import Enum
from functools import lru_cache
from pathlib import Path
from typing import Literal

import jwt
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr, Field
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError, PyMongoError

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
    database = get_database()
    email = str(request.email).lower()
    user = database.users.find_one({"email": email})
    response = {"message": "If an account exists, password reset instructions will be sent."}
    if not user:
        return response
    raw_token = secrets.token_urlsafe(32)
    database.password_resets.insert_one({"user_id": user["_id"], "token_hash": hashlib.sha256(raw_token.encode()).hexdigest(), "expires_at": datetime.now(timezone.utc) + timedelta(minutes=30)})
    if os.getenv("APP_ENV", "development") == "development":
        response["development_reset_token"] = raw_token
    return response


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
