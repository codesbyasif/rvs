"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, ClipboardCheck, Eye, EyeOff, FileCheck2, LogOut, ShieldCheck, XCircle } from "lucide-react";

type Status = "pending_manual_verification" | "approved" | "rejected";
type DocumentField = "qualification_cert" | "workplace_proof";
type Application = {
  id: string;
  status: Status;
  submitted_at: string;
  reviewed_at?: string;
  name: string;
  specialization: string;
  experience: string;
  registration_number: string;
  contact_email: string;
  contact_phone: string;
  hospital_location: string;
  documents: Record<DocumentField, { original_name: string }>;
};

const statusLabels: Record<Status, string> = {
  pending_manual_verification: "Pending review",
  approved: "Verified",
  rejected: "Rejected"
};

export default function AdminPage() {
  const [authenticated, setAuthenticated] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [applications, setApplications] = useState<Application[]>([]);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const loadApplications = async () => {
    const response = await fetch("/api/admin/applications", { cache: "no-store" });
    const data: { applications?: Application[]; error?: string } = await response.json();
    if (!response.ok) throw new Error(data.error || "Applications could not be loaded.");
    setApplications(data.applications ?? []);
  };

  useEffect(() => {
    let active = true;
    fetch("/api/admin/session", { cache: "no-store" })
      .then(response => response.json())
      .then(async (data: { authenticated: boolean }) => {
        if (!active) return;
        setAuthenticated(data.authenticated);
        if (data.authenticated) await loadApplications();
      })
      .catch(() => { if (active) setError("Could not connect to admin review."); })
      .finally(() => { if (active) setCheckingSession(false); });
    return () => { active = false; };
  }, []);

  const signIn = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    try {
      const response = await fetch("/api/admin/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data: { error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error || "Admin sign-in failed.");
      setAuthenticated(true);
      setPassword("");
      await loadApplications();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Admin sign-in failed.");
    }
  };

  const review = async (applicationId: string, status: "approved" | "rejected") => {
    setBusyId(applicationId);
    setError("");
    try {
      const response = await fetch("/api/admin/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ application_id: applicationId, status })
      });
      const data: { error?: string } = await response.json();
      if (!response.ok) throw new Error(data.error || "Could not save the review decision.");
      await loadApplications();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save the review decision.");
    } finally {
      setBusyId("");
    }
  };

  const signOut = async () => {
    await fetch("/api/admin/session", { method: "DELETE" });
    setAuthenticated(false);
    setApplications([]);
  };

  return <main className="admin-page">
    <header className="signup-topbar">
      <Link className="brand" href="/"><span className="brand-mark"><img src="/medsafe-logo.svg" alt="" /></span><span>Med<span>Safe</span></span></Link>
      <Link className="signup-back" href="/"><ArrowLeft size={16} /> Back to home</Link>
    </header>
    <div className="admin-content">
      <div className="signup-intro"><span className="eyebrow">Restricted access</span><h1>Doctor verification</h1><p className="muted">Review submitted credentials and workplace proof before making a decision.</p></div>
      {checkingSession ? <p className="admin-loading">Checking admin session…</p> : !authenticated ? <form className="admin-login" onSubmit={signIn}>
        <div className="admin-login-icon"><ShieldCheck size={23} /></div>
        <h2>Admin sign in</h2>
        <p className="muted">Use the review password configured by the project administrator.</p>
        <label className="signup-field"><span>Admin review password</span><span className="password-field"><input type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" required /><button type="button" className="password-toggle" onClick={() => setShowPassword(current => !current)} aria-label={showPassword ? "Hide admin password" : "Show admin password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>
        {error && <p className="admin-error" role="alert">{error}</p>}
        <button className="button primary admin-login-button" type="submit">Sign in to review</button>
        
      </form> : <section className="admin-dashboard">
        <div className="admin-dashboard-heading"><div><h2>Applications</h2><p className="muted">Check each document against the doctor’s registration details and current workplace.</p></div><button className="button secondary" onClick={signOut}><LogOut size={16} /> Sign out</button></div>
        {error && <p className="admin-error" role="alert">{error}</p>}
        {applications.length === 0 ? <div className="admin-empty"><ClipboardCheck size={26} /><strong>No doctor applications yet</strong><span>New signup submissions will appear here.</span></div> : <div className="admin-applications">{applications.map(application =>
          <article className="admin-application" key={application.id}>
            <div className="admin-application-heading"><div><span className="eyebrow">Submitted {new Date(application.submitted_at).toLocaleString()}</span><h3>{application.name}</h3></div><span className={`admin-status ${application.status}`}>{statusLabels[application.status]}</span></div>
            <div className="admin-details">
              <p><strong>Specialization</strong><span>{application.specialization} · {application.experience} years</span></p>
              <p><strong>Registration number</strong><span>{application.registration_number}</span></p>
              <p><strong>Contact</strong><span>{application.contact_email}<br />{application.contact_phone}</span></p>
              <p><strong>Current workplace</strong><span>{application.hospital_location}</span></p>
            </div>
            <div className="admin-documents">{([
              ["qualification_cert", "Qualification / registration certificate"],
              ["workplace_proof", "Current workplace proof"]
            ] as const).map(([field, label]) => <a key={field} className="admin-document-link" href={`/api/admin/documents?application_id=${encodeURIComponent(application.id)}&field=${field}`} target="_blank" rel="noreferrer"><FileCheck2 size={17} /><span><strong>{label}</strong><small>{application.documents[field]?.original_name ?? "Document"}</small></span></a>)}</div>
            {application.status === "pending_manual_verification" ? <div className="admin-actions"><button className="button primary" disabled={busyId === application.id} onClick={() => review(application.id, "approved")}><CheckCircle2 size={17} /> Approve as verified</button><button className="button admin-reject" disabled={busyId === application.id} onClick={() => review(application.id, "rejected")}><XCircle size={17} /> Reject application</button></div> : <p className="admin-reviewed">Reviewed {application.reviewed_at ? new Date(application.reviewed_at).toLocaleString() : ""}. {application.status === "approved" ? "Credentials marked verified." : "Application rejected."}</p>}
            {application.status === "pending_manual_verification" && <p className="admin-caution">Approve only after independently validating the registration and confirming current workplace proof. Verification does not automatically create or promise a consultant job.</p>}
          </article>
        )}</div>}
      </section>}
    </div>
  </main>;
}
