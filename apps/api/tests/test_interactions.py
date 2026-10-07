from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_warfarin_aspirin_is_high():
    response = client.post("/api/interactions/check", json={"medicines": ["Warfarin", "Aspirin"]})
    assert response.status_code == 200
    assert response.json()[0]["severity"] == "High"


def test_no_known_interaction_returns_empty_list():
    response = client.post("/api/interactions/check", json={"medicines": ["Metformin", "Amlodipine"]})
    assert response.status_code == 200
    assert response.json() == []
