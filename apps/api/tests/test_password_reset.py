import re
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient

from app import main


class FakeCollection:
    def __init__(self):
        self.documents = []

    def find_one(self, query):
        for document in self.documents:
            if all(self._matches(document, key, expected) for key, expected in query.items()):
                return document
        return None

    def insert_one(self, document):
        stored = {**document, "_id": object()}
        self.documents.append(stored)
        return SimpleNamespace(inserted_id=stored["_id"])

    def delete_one(self, query):
        document = self.find_one(query)
        if document:
            self.documents.remove(document)

    def delete_many(self, query):
        self.documents[:] = [
            document for document in self.documents
            if not all(self._matches(document, key, expected) for key, expected in query.items())
        ]

    def update_one(self, query, update):
        document = self.find_one(query)
        if document:
            document.update(update.get("$set", {}))
            for key, amount in update.get("$inc", {}).items():
                document[key] = document.get(key, 0) + amount
        return SimpleNamespace(matched_count=int(document is not None))

    def find_one_and_delete(self, query):
        document = self.find_one(query)
        if document:
            self.documents.remove(document)
        return document

    @staticmethod
    def _matches(document, key, expected):
        value = document.get(key)
        if isinstance(expected, dict):
            return all(
                value > bound if operator == "$gt" else value < bound
                for operator, bound in expected.items()
            )
        return value == expected


class FakeDatabase:
    def __init__(self, user=None):
        self.users = FakeCollection()
        self.password_resets = FakeCollection()
        if user:
            self.users.documents.append(user)


class FakeSMTP:
    messages = []

    def __init__(self, *args, **kwargs):
        pass

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return None

    def ehlo(self):
        pass

    def starttls(self, **kwargs):
        pass

    def login(self, *args):
        pass

    def send_message(self, message):
        self.messages.append(message)


@pytest.fixture
def setup_reset(monkeypatch):
    email = "person@example.com"
    database = FakeDatabase({"_id": "user-1", "email": email, "password_hash": "old"})
    monkeypatch.setattr(main, "get_database", lambda: database)
    monkeypatch.setattr(main.smtplib, "SMTP", FakeSMTP)
    monkeypatch.setenv("SMTP_HOST", "smtp.example.com")
    monkeypatch.setenv("SMTP_FROM_EMAIL", "noreply@example.com")
    monkeypatch.setenv("SMTP_USERNAME", "smtp-user")
    monkeypatch.setenv("SMTP_PASSWORD", "smtp-password")
    monkeypatch.setenv("SMTP_PORT", "587")
    monkeypatch.setenv("SMTP_USE_SSL", "false")
    monkeypatch.setenv("JWT_SECRET", "test-secret-that-is-at-least-32-characters")
    FakeSMTP.messages = []
    return TestClient(main.app), database, email


def test_forgot_password_emails_code_without_returning_it(setup_reset):
    client, database, email = setup_reset

    response = client.post("/api/auth/forgot-password", json={"email": email})

    assert response.status_code == 200
    assert response.json() == {"message": "If an account exists, password reset instructions will be sent."}
    assert len(FakeSMTP.messages) == 1
    sent_code = re.search(r"\b\d{6}\b", FakeSMTP.messages[0].get_content()).group()
    reset = database.password_resets.documents[0]
    assert sent_code not in response.text
    assert reset["email"] == email
    assert reset["purpose"] == "email_otp"
    assert reset["otp_hash"] != sent_code
    assert reset["attempts"] == 0


def test_forgot_password_response_does_not_reveal_unknown_account(setup_reset):
    client, database, _ = setup_reset

    response = client.post("/api/auth/forgot-password", json={"email": "unknown@example.com"})

    assert response.status_code == 200
    assert response.json() == {"message": "If an account exists, password reset instructions will be sent."}
    assert not database.password_resets.documents
    assert not FakeSMTP.messages


def test_otp_resets_password_once(setup_reset):
    client, database, email = setup_reset
    client.post("/api/auth/forgot-password", json={"email": email})
    code = re.search(r"\b\d{6}\b", FakeSMTP.messages[0].get_content()).group()

    response = client.post(
        "/api/auth/reset-password/otp",
        json={"email": email, "otp": code, "password": "new-password-123"},
    )

    assert response.status_code == 200
    assert main.password_matches("new-password-123", database.users.documents[0]["password_hash"])
    assert not database.password_resets.documents
    reused = client.post(
        "/api/auth/reset-password/otp",
        json={"email": email, "otp": code, "password": "another-password-123"},
    )
    assert reused.status_code == 400


def test_otp_attempts_are_limited(setup_reset):
    client, database, email = setup_reset
    client.post("/api/auth/forgot-password", json={"email": email})
    sent_code = re.search(r"\b\d{6}\b", FakeSMTP.messages[0].get_content()).group()
    wrong_code = "000000" if sent_code != "000000" else "000001"

    for _ in range(5):
        response = client.post(
            "/api/auth/reset-password/otp",
            json={"email": email, "otp": wrong_code, "password": "new-password-123"},
        )
        assert response.status_code == 400

    blocked = client.post(
        "/api/auth/reset-password/otp",
        json={"email": email, "otp": wrong_code, "password": "new-password-123"},
    )
    assert blocked.status_code == 429
    assert database.password_resets.documents[0]["attempts"] == 5
