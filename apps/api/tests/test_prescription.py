import json
from types import SimpleNamespace

import httpx
from openai import APIStatusError
from fastapi.testclient import TestClient

from app import main


client = TestClient(main.app)
PNG = b"\x89PNG\r\n\x1a\n" + b"test-image-data"


def test_analyze_prescription_runs_ocr_then_groq(monkeypatch):
    monkeypatch.setattr(
        main,
        "provider_api_key",
        lambda name: {"OCR_API_KEY": "test-ocr-key", "GROQ_API_KEY": "test-groq-key"}[name],
    )
    calls = []
    real_client = httpx.Client

    def provider_response(request):
        calls.append(("http", request.url.host))
        if request.url.host == "api.ocr.space":
            assert request.headers["apikey"] == "test-ocr-key"
            assert 'filename="prescription.png"' in request.content.decode("latin-1")
            return httpx.Response(200, json={"ParsedResults": [{
                "ParsedText": "Take amoxicillin 500 mg three times daily for 7 days."
            }]})

        raise AssertionError("Groq should be called through the OpenAI SDK")

    analysis_json = json.dumps({
            "medicines": [{
                "medicine_name": "Amoxicillin",
                "strength": "500 mg",
                "dosage": "1 capsule",
                "frequency": "Three times daily",
                "timing": "With food",
                "duration": "7 days",
                "instructions": "Complete the prescribed course.",
            }],
            "side_effects": ["Nausea"],
            "drug_drug_interactions": [],
            "drug_food_interactions": [],
            "warnings": ["Confirm instructions with your pharmacist."],
        })

    class FakeResponses:
        def create(self, **kwargs):
            calls.append(("responses.create", kwargs))
            assert kwargs["model"] == "openai/gpt-oss-20b"
            assert "Take amoxicillin 500 mg three times daily for 7 days." in kwargs["input"]
            assert "return only JSON" in kwargs["input"]
            assert "Do not guess" in kwargs["instructions"]
            return SimpleNamespace(output_text=analysis_json)

    class FakeOpenAI:
        def __init__(self, **kwargs):
            assert kwargs["api_key"] == "test-groq-key"
            assert kwargs["base_url"] == "https://api.groq.com/openai/v1"
            assert kwargs["max_retries"] == 0
            calls.append(("openai", kwargs))
            self.responses = FakeResponses()

    monkeypatch.setattr(main, "OpenAI", FakeOpenAI)

    monkeypatch.setattr(
        main.httpx,
        "Client",
        lambda **kwargs: real_client(transport=httpx.MockTransport(provider_response), **kwargs),
    )

    response = client.post(
        "/api/prescription/analyze",
        files={"file": ("prescription.png", PNG, "image/png")},
    )

    assert response.status_code == 200
    assert response.json() == {
        "ocr_text": "Take amoxicillin 500 mg three times daily for 7 days.",
        "analysis": {
            "medicines": [{
                "medicine_name": "Amoxicillin",
                "strength": "500 mg",
                "dosage": "1 capsule",
                "frequency": "Three times daily",
                "timing": "With food",
                "duration": "7 days",
                "instructions": "Complete the prescribed course.",
            }],
            "side_effects": ["Nausea"],
            "drug_drug_interactions": [],
            "drug_food_interactions": [],
            "warnings": ["Confirm instructions with your pharmacist."],
        },
    }
    assert calls[0] == ("http", "api.ocr.space")
    assert calls[1][0] == "openai"
    assert calls[2][0] == "responses.create"


def test_analyze_prescription_rejects_mismatched_file_before_api_calls(monkeypatch):
    monkeypatch.setattr(main, "provider_api_key", lambda _: "test-key")
    monkeypatch.setattr(
        main,
        "extract_prescription_text",
        lambda *_: (_ for _ in ()).throw(AssertionError("OCR must not be called")),
    )

    response = client.post(
        "/api/prescription/analyze",
        files={"file": ("prescription.png", b"not a PNG", "image/png")},
    )

    assert response.status_code == 415
    assert "contents do not match" in response.json()["detail"]


def test_analyze_prescription_does_not_call_groq_when_ocr_finds_no_text(monkeypatch):
    monkeypatch.setattr(main, "provider_api_key", lambda _: "test-key")
    monkeypatch.setattr(main, "extract_prescription_text", lambda *_: "  ")
    monkeypatch.setattr(
        main,
        "analyze_prescription_text",
        lambda *_: (_ for _ in ()).throw(AssertionError("Groq must not be called")),
    )

    response = client.post(
        "/api/prescription/analyze",
        files={"file": ("prescription.png", PNG, "image/png")},
    )

    assert response.status_code == 422
    assert "No prescription text" in response.json()["detail"]


def test_analyze_prescription_reports_missing_provider_key(monkeypatch):
    monkeypatch.setattr(main, "provider_api_key", lambda _: "")

    response = client.post(
        "/api/prescription/analyze",
        files={"file": ("prescription.png", PNG, "image/png")},
    )

    assert response.status_code == 503
    assert "OCR_API_KEY" in response.json()["detail"]


def test_analyze_prescription_reports_missing_groq_key(monkeypatch):
    monkeypatch.setattr(
        main,
        "provider_api_key",
        lambda name: "test-ocr-key" if name == "OCR_API_KEY" else "",
    )

    response = client.post(
        "/api/prescription/analyze",
        files={"file": ("prescription.png", PNG, "image/png")},
    )

    assert response.status_code == 503
    assert "GROQ_API_KEY" in response.json()["detail"]


def test_analyze_prescription_includes_safe_groq_error_detail(monkeypatch):
    monkeypatch.setattr(
        main,
        "provider_api_key",
        lambda name: {"OCR_API_KEY": "test-ocr-key", "GROQ_API_KEY": "test-groq-key"}[name],
    )
    real_client = httpx.Client

    monkeypatch.setattr(
        main.httpx,
        "Client",
        lambda **kwargs: real_client(
            transport=httpx.MockTransport(
                lambda request: httpx.Response(
                    200,
                    json={"ParsedResults": [{"ParsedText": "Medicine 10 mg"}]},
                )
            ),
            **kwargs,
        ),
    )

    error_response = httpx.Response(
        404,
        json={"error": {"message": "The requested model is not available."}},
        request=httpx.Request("POST", "https://api.groq.com/openai/v1/responses"),
    )

    class FakeResponses:
        def create(self, **kwargs):
            raise APIStatusError(
                "The requested model is not available.",
                response=error_response,
                body={"error": {"message": "The requested model is not available."}},
            )

    class FakeOpenAI:
        def __init__(self, **kwargs):
            self.responses = FakeResponses()

    monkeypatch.setattr(main, "OpenAI", FakeOpenAI)

    response = client.post(
        "/api/prescription/analyze",
        files={"file": ("prescription.png", PNG, "image/png")},
    )

    assert response.status_code == 502
    assert response.json()["detail"] == (
        "Groq request failed (HTTP 404): The requested model is not available."
    )
