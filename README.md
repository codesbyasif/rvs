# MedSafe

MedSafe is a calm, elderly-first prototype for understanding possible drug-drug and drug-food interactions. It is intentionally a clinical decision-support demo, not a diagnosis, prescription, or substitute for a doctor or pharmacist.

## What is included

- Responsive Next.js/React/TypeScript experience with dashboard, medicines, safety alerts, interaction graph, and doctor summary views.
- Doctor signup prototype at `/doctor-signup` with required medical credential and current-workplace proof fields for manual verification.
- A prescription upload/review flow with explicit OCR confidence and low-confidence confirmation state.
- Browser voice playback for important explanations.
- English/Hindi language controls in the UI foundation.
- FastAPI demo interaction service with typed Pydantic schemas and a provider-ready boundary.
- Clearly labeled demo knowledge and identifiers; no clinical evidence is presented as validated.

## Structure

```text
app/                    Next.js UI and design system
apps/api/app/main.py    FastAPI demo service
apps/api/tests/         API tests
.env.example            Local-only environment placeholders
```

## Run locally

```powershell
npm install
npm run setup:api
npm run dev
```

Open `http://localhost:3000`. To run both the web app and API together, use
`npm run dev:all` after the one-time API setup. The API setup creates a local
virtual environment and installs `apps/api/requirements.txt`.

To set up the API manually instead:

```powershell
cd apps/api
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Run API tests from `apps/api` with `pytest`.

### MongoDB authentication setup

Copy `.env.example` to `.env` and set `MONGODB_URI`, `MONGODB_DATABASE`, and a
long random `JWT_SECRET`. The API exposes:

- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password/otp`
- `POST /api/auth/reset-password`

The frontend auth screens are available at `/login` and `/reset-password`.
Password recovery emails a six-digit, single-use code that expires after 10
minutes. Configure `SMTP_HOST` and `SMTP_FROM_EMAIL` in the project-root
`.env`; authenticated providers also need `SMTP_USERNAME` and `SMTP_PASSWORD`.
`SMTP_PORT` defaults to `587`; set `SMTP_USE_SSL=true` for implicit TLS on
providers using port `465`. For Gmail, use an App Password rather than your
regular account password. Restart the API after changing `.env`. Recovery
requires MongoDB and a `JWT_SECRET` of at least 32 characters. Authentication
is MongoDB-backed when `MONGODB_URI` is configured; without it, auth endpoints
return an explicit service-unavailable response rather than pretending to
persist users.

## Architecture and safety

Doctor signup submissions are saved by `POST /api/doctor-applications`. The route stores uniquely named documents and an append-only `uploads/doctor-applications.jsonl` record in the project root. The directory is created on first submission. Treat this local prototype storage as sensitive: configure access controls, retention, backups, and a secure deployment storage strategy before collecting real clinician documents.

## Admin doctor verification

Open `/admin` (also linked from the home page) to sign in, review submitted doctor details and documents, then mark an application verified or rejected. Configure only `ADMIN_REVIEW_PASSWORD` (at least 12 characters; 16 or more is recommended) in the project-root `.env`, then restart the dev server. Keep the password private. The admin session is an HttpOnly, SameSite=Strict cookie with an eight-hour lifetime, signed using the configured password; changing the password invalidates existing sessions. This single-password approach is intended only for a local prototype, not a production admin system. Approval verifies application credentials for this prototype only; it does not automatically create or promise a consultant job.

The UI currently uses a typed demo dataset so the product can be demonstrated without credentials. The FastAPI interaction schema is designed for a verified interaction repository, with `evidence`, `last_verified`, and `requires_clinician_review` required on every interaction. A production integration should add PostgreSQL repositories, Neo4j graph persistence, RxNorm normalization, and an OCR provider adapter behind the API; it must not silently replace demo data with unvalidated LLM output.

Environment placeholders for PostgreSQL, Neo4j, OCR, RxNorm, and optional explanation services are in `.env.example`. Never commit credentials or prescription images.

## Accessibility

The prototype uses semantic controls, visible keyboard focus, readable base text, large touch targets, severity labels in addition to color, responsive layout, `role="alert"`/status patterns where relevant, and reduced-motion support. Voice is intentionally user initiated and uses the browser SpeechSynthesis API.

## Demo data and disclaimer

The profile (Ramesh Kumar, age 68) and all interaction sources are fictional demo data. “Demo interaction — replace with a validated source before clinical use” is shown wherever evidence is referenced. Do not stop, start, substitute, or change a medicine based on this prototype.
