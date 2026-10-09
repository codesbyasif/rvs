# MedSafe

MedSafe is a responsive medication-safety prototype for patients, families, and care teams. It demonstrates how people can review medicine information, possible interactions, and prescription summaries in one place. It is not a diagnosis, prescription, or substitute for a doctor or pharmacist.

## Website structure

The website uses the Next.js App Router. The dashboard views (Home, My medicines, Safety alerts, Interaction graph, and Report summary) are sections inside the home page rather than separate URLs.

| URL | Purpose |
| --- | --- |
| `/` | Medication-safety dashboard with the demo medicine list, alerts, interaction graph, report summary, account controls, and prescription-analysis dialog. |
| `/login` | Sign in, create an account, or request a one-time email password-reset code. |
| `/reset-password` | Set a new password from a reset link containing a token. |
| `/doctor-signup` | Submit clinician contact and registration details with qualification and current-workplace documents for manual review. |
| `/admin` | Password-protected review queue for approving or rejecting doctor applications and viewing submitted documents. |

### Source layout

```text
app/
  api/
    admin/
      applications/route.ts    Admin application list and review actions
      documents/route.ts       Protected access to submitted documents
      session/route.ts         Admin sign-in, session check, and sign-out
    doctor-applications/
      route.ts                 Doctor application submission
  admin/page.tsx               Doctor verification dashboard
  doctor-signup/page.tsx       Clinician application form
  login/page.tsx               Sign-in, signup, and email-code recovery
  reset-password/page.tsx      Reset-link password form
  page.tsx                     Main dashboard and interactive views
  layout.tsx                   Shared document metadata and global stylesheet
  globals.css                  Website styles and responsive layouts
lib/
  admin-auth.ts                Admin password and signed session helpers
  doctor-applications.ts       Local application record storage and updates
public/
  medsafe-logo.svg             Shared MedSafe logo
apps/api/
  app/main.py                  FastAPI authentication, interaction, and OCR API
  requirements.txt             Python API dependencies
  tests/                       API tests
  .env.example                 OCR and Groq key template
```

## Dashboard features

- Patient-friendly home screen with an age and health-condition entry point. Sign-in is required before entering health details or uploading a prescription.
- Dashboard sections for medicines, safety alerts, an interaction graph, and a report summary.
- English and Hindi language controls, user-initiated browser text-to-speech, and responsive navigation.
- Prescription upload accepts JPG, PNG, and PDF files up to 10 MB. The backend sends the file to OCR.space, then submits extracted text to Groq for an AI-generated summary of medicines, dosage details, possible side effects, drug-drug and drug-food interactions, and warnings.
- Authentication screens support signup, sign-in, email-code password recovery, and token-link password reset.
- Doctor applications collect contact and professional registration information plus a qualification certificate and proof of current workplace. Each document must be a PDF, JPG, or PNG up to 2 MB.
- Admin review lets a reviewer inspect application details and documents, then mark an application verified or rejected.

## Run locally

From the repository root in PowerShell:

```powershell
npm install
npm run setup:api
npm run dev:all
```

Open `http://localhost:3000`. `npm run dev:all` starts the Next.js website and the FastAPI backend on port `8000`; the backend setup creates `apps/api/.venv` and installs `apps/api/requirements.txt`. To run only the website, use `npm run dev`.

### Configure environment variables

Copy `apps/api/.env.example` to `apps/api/.env` and set `OCR_API_KEY` and `GROQ_API_KEY` to your own provider credentials to enable prescription analysis. The backend reads these values from `apps/api/.env` or the project-root `.env`. Never put provider credentials in frontend code or `NEXT_PUBLIC_*` variables.

Create a project-root `.env` for features that need application configuration:

```dotenv
MONGODB_URI=
MONGODB_DATABASE=medsafe
JWT_SECRET=
ADMIN_REVIEW_PASSWORD=
SMTP_HOST=
SMTP_PORT=587
SMTP_FROM_EMAIL=
SMTP_USERNAME=
SMTP_PASSWORD=
SMTP_USE_SSL=false
FRONTEND_ORIGINS=http://localhost:3000
```

Set a long random `JWT_SECRET` (at least 32 characters) and an `ADMIN_REVIEW_PASSWORD` of at least 12 characters. MongoDB configuration is required for persistent account signup and sign-in. Email recovery also requires the SMTP settings; use an app password for email providers such as Gmail. `SMTP_USERNAME` and `SMTP_PASSWORD` may be left blank when using an unauthenticated mail relay. Set `SMTP_USE_SSL=true` for implicit TLS, commonly on port `465`. Restart the relevant server after changing environment variables.

The frontend uses `http://localhost:8000` as the default API URL. Set `NEXT_PUBLIC_API_URL` at build/runtime when the API is hosted elsewhere. Configure `FRONTEND_ORIGINS` on the API to allow the website's origin.

### Run the API manually

```powershell
cd apps/api
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
```

Run the API tests from `apps/api` with:

```powershell
.\.venv\Scripts\python.exe -m pytest tests
```

## API endpoints

The FastAPI service is implemented in `apps/api/app/main.py`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | API health check. |
| `POST` | `/api/auth/signup` | Create a MongoDB-backed account. |
| `POST` | `/api/auth/login` | Authenticate and return an access token. |
| `POST` | `/api/auth/forgot-password` | Send a one-time password-reset code by email. |
| `POST` | `/api/auth/reset-password/otp` | Reset a password with an email code. |
| `POST` | `/api/auth/reset-password` | Reset a password using a token link. |
| `POST` | `/api/prescription/analyze` | Accept a multipart `file` upload and return OCR text with a structured AI summary. |
| `POST` | `/api/interactions/check` | Check medicine and food inputs against the demo interaction dataset. |
| `GET` | `/api/interactions/{interaction_id}` | Retrieve a demo interaction by ID. |
| `GET` | `/api/graph` | Return the demo interaction graph data. |

The Next.js application also provides `/api/doctor-applications` for clinician submissions and `/api/admin/*` endpoints for admin sessions, application review, and protected document access.

## Data handling and clinical safety

- Prescription uploads are limited to 10 MB, are processed by OCR.space and Groq, and are not saved by the MedSafe application. Both providers receive prescription data for processing. Their own retention and privacy terms apply.
- Doctor application details and verification documents are saved locally under `uploads/`, with application records appended to `uploads/doctor-applications.jsonl`. This prototype storage is sensitive; configure access controls, retention, backups, and secure deployment storage before collecting real clinician documents.
- The admin interface uses a single configured review password and an HttpOnly, SameSite=Strict session cookie with an eight-hour lifetime. This is a local prototype mechanism, not a production admin identity system.
- Admin approval records a manual review decision; it does not automatically create or promise a consultant job.
- Interaction checking uses fictional demo data and identifiers. Demo interaction evidence is explicitly marked as requiring replacement with a validated source. Prescription analysis is AI-generated and is not a validated clinical interaction check. Review all findings with a clinician or pharmacist.
- Never commit credentials, real prescription images, or real patient data.

## Accessibility

The prototype uses semantic controls, visible keyboard focus, readable text, large touch targets, text labels in addition to severity color, responsive layouts, status/alert announcements where relevant, and reduced-motion support. Voice playback is user initiated and uses the browser SpeechSynthesis API.

## Demo disclaimer

The sample patient profile and interaction records are fictional. Do not start, stop, substitute, or change a medicine based on this prototype.
