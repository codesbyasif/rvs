"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import {
  ArrowLeft, ArrowRight, CheckCircle2, FileCheck2, LoaderCircle, LockKeyhole,
  ShieldCheck, Stethoscope, Upload
} from "lucide-react";

type DocumentKey = "qualification" | "employment";

const documentLabels: Record<DocumentKey, string> = {
  qualification: "Medical qualification / registration certificate",
  employment: "Proof of current workplace"
};

const MAX_FILE_SIZE = 2 * 1024 * 1024;
const allowedExtensions = new Set([".pdf", ".jpg", ".jpeg", ".png"]);

export default function DoctorSignupPage() {
  const [documents, setDocuments] = useState<Record<DocumentKey, File | null>>({
    qualification: null,
    employment: null
  });
  const [fileErrors, setFileErrors] = useState<Partial<Record<DocumentKey, string>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [applicationId, setApplicationId] = useState("");

  const selectDocument = (key: DocumentKey, file: File | undefined) => {
    if (!file) return;
    const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
    if (!allowedExtensions.has(extension)) {
      setFileErrors(current => ({ ...current, [key]: "Choose a PDF, JPG, or PNG file." }));
      setDocuments(current => ({ ...current, [key]: null }));
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      setFileErrors(current => ({ ...current, [key]: "Each file must be 2 MB or smaller." }));
      setDocuments(current => ({ ...current, [key]: null }));
      return;
    }
    setDocuments(current => ({ ...current, [key]: file }));
    setFileErrors(current => ({ ...current, [key]: undefined }));
    setSubmitError("");
  };

  const submitApplication = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitError("");
    const form = event.currentTarget;
    const data = new FormData(form);
    const qualification = documents.qualification;
    const employment = documents.employment;
    if (!qualification || !employment) {
      setSubmitError("Please attach both verification documents.");
      return;
    }
    data.set("qualification_cert", qualification);
    data.set("workplace_proof", employment);
    setIsSubmitting(true);
    try {
      const response = await fetch("/api/doctor-applications", { method: "POST", body: data });
      const result: { error?: string; application_id?: string } = await response.json();
      if (!response.ok) {
        throw new Error(result.error || "We could not submit your application. Please try again.");
      }
      setApplicationId(result.application_id ?? "");
      setSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "We could not submit your application. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return <main className="signup-page">
    <header className="signup-topbar">
      <Link className="brand" href="/"><span className="brand-mark"><ShieldCheck size={22} /></span><span>Med<span>Safe</span></span></Link>
      <Link className="signup-back" href="/"><ArrowLeft size={16} /> Back to home</Link>
    </header>

    <div className="signup-content">
      <div className="signup-intro">
        <span className="eyebrow">For licensed clinicians</span>
        <h1>Join MedSafe as a doctor</h1>
        <p className="muted">Share your professional details and documents. Every application is intended to be checked by a person before a clinician profile is approved.</p>
      </div>

      {submitted ? <section className="signup-success" role="status" aria-labelledby="signup-success-title">
        <div className="signup-success-icon"><CheckCircle2 size={28} /></div>
        <span className="eyebrow">Application form complete</span>
        <h2 id="signup-success-title">Application received</h2>
        <p>Your details and verification documents have been saved for manual review.</p>
        {applicationId && <p className="signup-application-id">Reference: <strong>{applicationId}</strong></p>}
        <div className="signup-demo-warning"><LockKeyhole size={18} /><p><strong>Manual review required:</strong> Your application is pending review. This does not mean your credentials have been verified or approved.</p></div>
        <button className="button secondary" onClick={() => setSubmitted(false)}>Submit another application</button>
      </section> : <form className="signup-form" onSubmit={submitApplication}>
        <section className="signup-section">
          <div className="signup-section-title"><span className="signup-step">01</span><div><h2>Professional details</h2><p>Tell us how to contact you and verify your registration.</p></div></div>
          <div className="signup-fields">
            <label className="signup-field"><span>Full name</span><input name="name" autoComplete="name" placeholder="Dr. Asha Sharma" required /></label>
            <label className="signup-field"><span>Medical specialization</span><select name="specialization" defaultValue="" required><option value="" disabled>Select specialization</option><option>General Practice</option><option>Cardiology</option><option>Dermatology</option><option>Endocrinology</option><option>Family Medicine</option><option>Internal Medicine</option><option>Neurology</option><option>Oncology</option><option>Paediatrics</option><option>Psychiatry</option><option>Other</option></select></label>
            <label className="signup-field"><span>Years of experience</span><input name="experience" type="number" min="0" max="70" inputMode="numeric" placeholder="e.g. 8" required /></label>
            <label className="signup-field"><span>Medical registration / license number</span><input name="registration_number" autoComplete="off" placeholder="Enter your registration number" required /></label>
            <label className="signup-field"><span>Contact email</span><input name="contact_email" type="email" autoComplete="email" placeholder="doctor@example.com" required /></label>
            <label className="signup-field"><span>Contact phone</span><input name="contact_phone" type="tel" autoComplete="tel" placeholder="+91 98765 43210" required /></label>
            <label className="signup-field signup-field-wide"><span>Current hospital / clinic and location</span><input name="hospital_location" autoComplete="organization" placeholder="Clinic or hospital name, city" required /></label>
          </div>
        </section>

        <section className="signup-section">
          <div className="signup-section-title"><span className="signup-step">02</span><div><h2>Verification documents</h2><p>Both documents are required for a human reviewer to confirm your credentials and current practice.</p></div></div>
          <div className="verification-note"><FileCheck2 size={19} /><p><strong>Manual verification required</strong><br />A certificate alone is not enough. Provide your qualification or medical registration certificate and separate proof that you currently work at the hospital or clinic listed above.</p></div>
          <div className="signup-upload-grid">{(["qualification", "employment"] as const).map(key =>
            <label className="signup-upload" key={key}>
              <span className="signup-upload-title">{documentLabels[key]} <b aria-hidden="true">*</b></span>
              <span className="signup-upload-hint">{key === "qualification" ? "Degree, board certificate, or medical council registration" : "Current staff ID, employer letter, or clinic credential"}</span>
              <span className="signup-file-button"><Upload size={17} /> {documents[key] ? "Choose a different file" : "Choose file"}</span>
              <span className="signup-file-name">{documents[key]?.name ?? "PDF, JPG, or PNG · Up to 2 MB"}</span>
              <input type="file" accept="application/pdf,image/jpeg,image/png" required={!documents[key]} onChange={event => selectDocument(key, event.currentTarget.files?.[0])} aria-label={documentLabels[key]} />
              {fileErrors[key] && <span className="signup-file-error" role="alert">{fileErrors[key]}</span>}
            </label>
          )}</div>
        </section>

        
        {submitError && <div className="signup-submit-error" role="alert">{submitError}</div>}
        <button className="button primary signup-submit" type="submit" disabled={isSubmitting}>
          {isSubmitting ? <><LoaderCircle className="signup-spinner" size={17} /> Submitting application…</> : <>Submit for manual verification <ArrowRight size={17} /></>}
        </button>
        <div className="verification-time"><FileCheck2 size={18} /><p><strong>Verification timeline</strong><span>Once your application is received, manual review may take 24–48 hours.</span></p></div>
      </form>}
      <div className="signup-footer"><Stethoscope size={16} /> Applications are not approved automatically. Credentials must be reviewed before any doctor profile is trusted.</div>
    </div>
  </main>;
}
