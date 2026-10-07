# MedSafe

MedSafe is a calm, elderly-first prototype for understanding possible drug-drug and drug-food interactions. It is intentionally a clinical decision-support demo, not a diagnosis, prescription, or substitute for a doctor or pharmacist.

## What is included

- Responsive Next.js/React/TypeScript experience with dashboard, medicines, safety alerts, interaction graph, and doctor summary views.
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
npm run dev
```

Open `http://localhost:3000`. The API can be run separately:

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
- `POST /api/auth/reset-password`

The frontend auth screens are available at `/login` and `/reset-password`.
Forgot-password requests intentionally return a development reset token only
when `APP_ENV=development`; configure a transactional email provider before
using this in production. Authentication is real MongoDB-backed when
`MONGODB_URI` is configured; without it, auth endpoints return an explicit
service-unavailable response rather than pretending to persist users.

## Architecture and safety

The UI currently uses a typed demo dataset so the product can be demonstrated without credentials. The FastAPI interaction schema is designed for a verified interaction repository, with `evidence`, `last_verified`, and `requires_clinician_review` required on every interaction. A production integration should add PostgreSQL repositories, Neo4j graph persistence, RxNorm normalization, and an OCR provider adapter behind the API; it must not silently replace demo data with unvalidated LLM output.

Environment placeholders for PostgreSQL, Neo4j, OCR, RxNorm, and optional explanation services are in `.env.example`. Never commit credentials or prescription images.

## Accessibility

The prototype uses semantic controls, visible keyboard focus, readable base text, large touch targets, severity labels in addition to color, responsive layout, `role="alert"`/status patterns where relevant, and reduced-motion support. Voice is intentionally user initiated and uses the browser SpeechSynthesis API.

## Demo data and disclaimer

The profile (Ramesh Kumar, age 68) and all interaction sources are fictional demo data. “Demo interaction — replace with a validated source before clinical use” is shown wherever evidence is referenced. Do not stop, start, substitute, or change a medicine based on this prototype.
