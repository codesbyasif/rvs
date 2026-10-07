from datetime import date
from enum import Enum
from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field

app = FastAPI(title="MedSafe API", version="0.1.0")


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
    return {"status": "ok", "environment": "demo"}


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
