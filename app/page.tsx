"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  Activity, AlertTriangle, ArrowRight, Check, ChevronDown, CircleHelp, Eye, EyeOff, FileText,
  Home as HomeIcon, Info, Languages, Leaf, Menu, Mic, Pill, Play, ShieldCheck,
  Stethoscope, Upload, Volume2, X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Severity = "High" | "Moderate" | "Monitor";
type View = "home" | "medicines" | "alerts" | "doctor" | "graph";
const medicines: { name: string; dose: string; frequency: string; confidence: number }[] = [];

const navItems: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Home", icon: HomeIcon }, { id: "medicines", label: "My medicines", icon: Pill },
  { id: "alerts", label: "Safety alerts", icon: AlertTriangle }, { id: "doctor", label: "Report summary", icon: Stethoscope }
];

function SpeakButton({ text, language }: { text: string; language: "en-IN" | "hi-IN" }) {
  const speak = () => {
    if ("speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = language;
      window.speechSynthesis.speak(utterance);
    }
  };
  return <button className="listen-button" onClick={speak} aria-label="Listen to this explanation"><Volume2 size={17} /> Listen</button>;
}

function Sidebar({ view, setView, language, setLanguage, onLogout, alertCount }: { view: View; setView: (v: View) => void; language: "en-IN" | "hi-IN"; setLanguage: (l: "en-IN" | "hi-IN") => void; onLogout: () => void; alertCount: number }) {
  return <aside className="sidebar" id="main-navigation">
    <div className="brand"><div className="brand-mark"><ShieldCheck size={22} /></div><span>Med<span>Safe</span></span></div>
    <div className="demo-badge"><span /> Private workspace</div>
    <nav aria-label="Main navigation">{navItems.map(({ id, label, icon: Icon }) =>
    <button key={id} className={`nav-item ${view === id ? "active" : ""}`} onClick={() => setView(id)}><Icon size={19} /><span>{label}</span>{id === "alerts" && alertCount > 0 && <b>{alertCount}</b>}</button>)}</nav>
    <div className="sidebar-bottom">
      <div className="help-card"><CircleHelp size={20} /><div><strong>Need help?</strong><small>Talk through your results</small></div><ArrowRight size={16} /></div>
      <button className="voice-link"><Mic size={18} /> Voice assistance <span className="status-dot" /></button>
      <button className="voice-link logout-link" onClick={onLogout}><ArrowRight size={18} /> Log out</button>
      <div className="language-row"><Languages size={17} /><button className={language === "en-IN" ? "selected" : ""} onClick={() => setLanguage("en-IN")}>English</button><span>/</span><button className={language === "hi-IN" ? "selected" : ""} onClick={() => setLanguage("hi-IN")}>हिन्दी</button></div>
    </div>
  </aside>;
}

function Header({ openAuth, email, onLogout }: { openAuth: (mode: "login" | "signup") => void; email: string; onLogout: () => void }) {
  return <header className="topbar"><div className="breadcrumb">My health <span>/</span> <strong>{email ? "Private workspace" : "Medication safety"}</strong></div><div className="top-actions">{email ? <><div className="profile"><div className="avatar">{email.slice(0, 1).toUpperCase()}</div><div className="profile-text"><strong>{email}</strong><small><span className="status-dot" /> Signed in</small></div></div><button className="auth-link" onClick={onLogout}>Sign out</button></> : <><button className="auth-link" onClick={() => openAuth("login")}>Sign in</button><button className="auth-signup" onClick={() => openAuth("signup")}>Create account</button></>}<button className="icon-button" aria-label="Help"><CircleHelp size={20} /></button></div></header>;
}

function SafetyCard({ onStart }: { onStart: () => void }) {
  return <section className="safety-card">
    <div className="safety-main"><div className="eyebrow"><span className="pulse-dot" /> Medication safety check</div><h1>Understand your medicines</h1><p className="muted intro">Check possible medicine and food interactions in one clear place.</p>
      <div className="status-line"><div className="status-icon"><ShieldCheck size={23} /></div><div><strong>Start with your health details</strong><span>Add your age, condition, or prescription to begin a private safety check.</span></div></div>
      <form className="guest-health-form" onSubmit={(event) => { event.preventDefault(); onStart(); }}><label>Age <input type="number" min="0" max="120" placeholder="Your age" /></label><label>Health condition <input type="text" placeholder="e.g. diabetes, high blood pressure" /></label><button className="button primary" type="submit">Continue securely <ArrowRight size={17} /></button></form>
      <div className="safety-actions"><button className="button primary" onClick={onStart}>Start a safety check <ArrowRight size={17} /></button><button className="button secondary" onClick={onStart}>Upload prescription</button></div>
    </div>
    <div className="safety-ring"><div className="ring"><div><strong>1</strong><span>simple<br />check</span></div></div><small>Your information stays private</small></div>
  </section>;
}

function LoginRequiredModal({ close, openAuth }: { close: () => void; openAuth: (mode: "login" | "signup") => void }) {
  return <div className="modal-backdrop" role="presentation"><div className="modal login-required" role="dialog" aria-modal="true" aria-labelledby="login-required-title"><button className="modal-close" onClick={close} aria-label="Close"><X size={20} /></button><div className="upload-icon"><ShieldCheck size={25} /></div><h2 id="login-required-title">Please sign in to continue</h2><p className="muted">Because this involves health information, we ask you to create an account before entering your age, condition, or prescription.</p><div className="login-required-actions"><button className="button primary full" onClick={() => { close(); openAuth("signup"); }}>Create account <ArrowRight size={17} /></button><button className="button secondary full" onClick={() => { close(); openAuth("login"); }}>Sign in</button></div><small className="muted">Your information is used only to prepare your private safety check.</small></div></div>;
}

function LogoutConfirmModal({ close, confirm }: { close: () => void; confirm: () => void }) {
  return <div className="modal-backdrop" role="presentation"><div className="modal login-required" role="dialog" aria-modal="true" aria-labelledby="logout-confirm-title"><button className="modal-close" onClick={close} aria-label="Close"><X size={20} /></button><div className="upload-icon"><ShieldCheck size={25} /></div><h2 id="logout-confirm-title">Log out of MedSafe?</h2><p className="muted">Are you sure you want to log out? Your private workspace will no longer be available on this device.</p><div className="login-required-actions"><button className="button primary full" onClick={confirm}>Yes, log out <ArrowRight size={17} /></button><button className="button secondary full" onClick={close}>Cancel</button></div></div></div>;
}

function AuthModal({ mode, close, onSuccess }: { mode: "login" | "signup"; close: () => void; onSuccess: (email: string) => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"}/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "Unable to complete request.");
      localStorage.setItem("medsafe_access_token", data.access_token);
      onSuccess(data.email ?? email);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to complete request.");
    } finally {
      setBusy(false);
    }
  };
  return <div className="modal-backdrop auth-modal-backdrop" role="presentation"><section className="auth-card auth-modal-card" role="dialog" aria-modal="true" aria-labelledby="auth-modal-title"><button className="modal-close" onClick={close} aria-label="Close"><X size={20} /></button><div className="brand auth-brand"><div className="brand-mark"><ShieldCheck size={22} /></div><span>Med<span>Safe</span></span></div><span className="eyebrow">{mode === "signup" ? "Create your account" : "Secure sign in"}</span><h1 id="auth-modal-title">{mode === "signup" ? "Start your safety journey" : "Welcome back"}</h1><p className="muted">Access your medication safety workspace securely.</p><form onSubmit={submit}><label>Email address<input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label><label>Password<span className="password-field"><input type={showPassword ? "text" : "password"} required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" /><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>{error && <div className="auth-error" role="alert">{error}</div>}<button className="button primary full" disabled={busy}>{busy ? "Please wait..." : mode === "signup" ? "Create account" : "Sign in"} <ArrowRight size={17} /></button></form></section></div>;
}

function MedicinesView({ onUpload }: { onUpload: () => void }) {
  return <><div className="page-heading"><div><span className="eyebrow">Your private list</span><h2>My medicines</h2><p className="muted">Sign in to securely add and manage your medicines.</p></div><button className="button primary" onClick={onUpload}><Upload size={17} /> Add prescription</button></div><div className="empty-state"><div className="upload-icon"><Pill size={25} /></div><h3>Your medicine list is empty</h3><p className="muted">After you sign in, you can upload a prescription or enter medicines manually.</p><button className="button secondary" onClick={onUpload}>Get started <ArrowRight size={17} /></button></div></>;
}

function AlertsView({ onListen, onDoctor }: { onListen: (text: string) => void; onDoctor: () => void }) {
  return <><div className="page-heading"><div><span className="eyebrow">Review together</span><h2>Safety alerts</h2><p className="muted">Alerts will appear here after your medicines are processed.</p></div><button className="button secondary" onClick={onDoctor}><FileText size={17} /> Report summary</button></div><div className="empty-state"><div className="upload-icon"><AlertTriangle size={25} /></div><h3>No safety alerts yet</h3><p className="muted">Upload a prescription or add medicines to run a safety check. Results from the clinical data service will appear here.</p></div><div className="clinical-note"><Stethoscope size={19} /><div><strong>Important</strong><p>Do not stop or change a medicine based on this tool. Talk to your doctor or pharmacist first.</p></div></div></>;
}

function GraphView() {
  return <><div className="page-heading"><div><span className="eyebrow">Verified relationships</span><h2>Interaction graph</h2><p className="muted">See why a medicine or food was flagged.</p></div><div className="verified"><Check size={15} /> Demo knowledge graph</div></div><div className="graph-panel"><div className="graph-canvas"><div className="graph-node drug warfarin"><Pill size={17} />Warfarin</div><div className="graph-node drug aspirin"><Pill size={17} />Aspirin</div><div className="graph-node outcome"><AlertTriangle size={16} />Increased bleeding risk</div><div className="graph-node food"><Leaf size={17} />Leafy greens</div><div className="graph-node outcome vitamin">Vitamin K</div><svg viewBox="0 0 680 410" preserveAspectRatio="none" aria-label="Interaction connections"><path d="M230 95 L430 95" /><path d="M510 120 L510 175" /><path d="M180 270 L180 330" /><path d="M245 350 L400 350" /></svg><span className="edge-label edge-one">high interaction</span><span className="edge-label edge-two">can increase</span><span className="edge-label edge-three">contains</span></div><aside className="why-panel"><span className="eyebrow">Why was this flagged?</span><h3>Warfarin + Aspirin</h3><div className="detail-row"><span>Severity</span><strong className="red-text">High</strong></div><div className="detail-row"><span>Type</span><strong>Medicine–medicine</strong></div><div className="detail-row"><span>Evidence</span><strong>Demo source</strong></div><div className="detail-row"><span>Last verified</span><strong>7 Oct 2026</strong></div><p className="source-note">Demo interaction — replace with a validated source before clinical use.</p></aside></div></>;
}

function DoctorView() {
  return <><div className="page-heading"><div><span className="eyebrow">Ready to share</span><h2>Report summary</h2><p className="muted">Your report will be generated after medicines and safety results are available.</p></div><button className="button primary" disabled><FileText size={17} /> Download summary</button></div><div className="empty-state"><div className="upload-icon"><FileText size={25} /></div><h3>Your report is not ready yet</h3><p className="muted">Process a prescription or add medicines first. The report generator will use your real medication and alert data.</p></div></>;
}

function UploadModal({ close }: { close: () => void }) {
  const [step, setStep] = useState<"upload" | "review">("upload");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [error, setError] = useState("");
  const [dragging, setDragging] = useState(false);

  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);

  const acceptFile = (candidate: File | undefined) => {
    if (!candidate) return;
    const supported = ["image/jpeg", "image/png", "application/pdf"];
    if (!supported.includes(candidate.type)) {
      setError("Please choose a JPG, PNG, or PDF prescription.");
      return;
    }
    if (candidate.size > 10 * 1024 * 1024) {
      setError("This file is larger than 10 MB. Please choose a smaller file.");
      return;
    }
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(candidate);
    setPreviewUrl(candidate.type.startsWith("image/") ? URL.createObjectURL(candidate) : "");
    setError("");
  };

  return <div className="modal-backdrop" role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="upload-title"><button className="modal-close" onClick={close} aria-label="Close"><X size={20} /></button>{step === "upload" ? <><div className="eyebrow">Step 1 of 3</div><h2 id="upload-title">Upload your prescription</h2><p className="muted">Choose a clear photo or PDF. The OCR service will process it after integration.</p><label className={`upload-zone ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files[0]); }}><input className="file-input" type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => acceptFile(event.target.files?.[0])} /><div className="upload-icon"><Upload size={25} /></div><strong>{file ? "Prescription ready to review" : "Drop a prescription here"}</strong><span>{file ? file.name : "or choose a clear photo or PDF"}</span><span className="button primary"><Upload size={17} /> {file ? "Choose another file" : "Choose file"}</span><small>JPG, PNG or PDF · Max 10 MB</small></label>{error && <div className="upload-error" role="alert"><AlertTriangle size={17} />{error}</div>}{file && <div className="file-preview">{previewUrl ? <img src={previewUrl} alt="Selected prescription preview" /> : <FileText size={21} />}<div><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB · Ready for demo OCR review</span></div><Check size={19} /></div>}<div className="privacy-note"><ShieldCheck size={17} /><span>Your prescription stays private in this demo.</span></div>{file && <button className="button primary full" onClick={() => setStep("review")}>Review medicines found <ArrowRight size={17} /></button>}</> : <><div className="eyebrow">Step 2 of 3</div><h2 id="upload-title">Review medicines found</h2><p className="muted">We read these from your prescription. Please check each one before continuing.</p><div className="review-list">{medicines.slice(0, 3).map(m => <div className="review-row" key={m.name}><div><strong>{m.name}</strong><span>{m.dose} · {m.frequency}</span></div><span className="confidence good">{m.confidence}% match</span></div>)}</div><div className="low-confidence"><AlertTriangle size={18} /><div><strong>Please check this medicine name</strong><p>Atorvastatin was harder to read. Confirm it before checking interactions.</p></div></div><button className="button primary full" onClick={close}>Check interactions <ArrowRight size={17} /></button></>}</div></div>;
}

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [language, setLanguage] = useState<"en-IN" | "hi-IN">("en-IN");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [toast, setToast] = useState("");
  const [loginPrompt, setLoginPrompt] = useState(false);
  const [logoutPrompt, setLogoutPrompt] = useState(false);
  const [authMode, setAuthMode] = useState<"login" | "signup" | null>(null);
  const [userEmail, setUserEmail] = useState("");
  useEffect(() => {
    const token = localStorage.getItem("medsafe_access_token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (typeof payload.email === "string") setUserEmail(payload.email);
      } catch {
        localStorage.removeItem("medsafe_access_token");
      }
    }
  }, []);
  const handleAuthSuccess = (email: string) => {
    setUserEmail(email);
    setAuthMode(null);
    setLoginPrompt(false);
    showToast("You are signed in. Your private workspace is ready.");
  };
  const confirmLogout = () => {
    localStorage.removeItem("medsafe_access_token");
    setUserEmail("");
    setView("home");
    setLogoutPrompt(false);
    showToast("You have been signed out.");
  };
  const handleLogout = () => setLogoutPrompt(true);
  const showToast = (text: string) => { setToast(text); window.setTimeout(() => setToast(""), 2500); };
  return <div className={`app-shell ${userEmail ? "authenticated-shell" : ""}`}>{userEmail && <div className="sidebar-wrap"><Sidebar view={view} setView={setView} language={language} setLanguage={setLanguage} onLogout={handleLogout} alertCount={0} /></div>}<div className="main-shell"><Header openAuth={setAuthMode} email={userEmail} onLogout={handleLogout} /><main className="content">{view === "home" && <><div className="welcome-row"><div><span className="eyebrow">{userEmail ? "Private medication workspace" : "Private medication support"}</span><h2>{userEmail ? "Welcome to your workspace" : "Your medication safety"}</h2></div><button className="button secondary upload-top" onClick={() => userEmail ? setUploadOpen(true) : setLoginPrompt(true)}><Upload size={17} /> Upload prescription</button></div>{userEmail ? <><div className="signed-in-panel"><div className="status-icon"><ShieldCheck size={23} /></div><div><h3>Your account is ready</h3><p className="muted">You are signed in as {userEmail}. Add your prescription or enter health details to begin your private safety check.</p></div><button className="button primary" onClick={() => setUploadOpen(true)}>Get started <ArrowRight size={17} /></button></div><div className="section-heading"><div><h3>Your private workspace</h3><p className="muted">Your medicines, safety alerts, and report summary will appear here.</p></div></div><div className="interaction-grid"><article className="info-banner feature-card"><Pill size={21} /><div><strong>My medicines</strong><p>Add a prescription or enter your medicines manually.</p></div></article><article className="info-banner feature-card"><Stethoscope size={21} /><div><strong>Report summary</strong><p>Prepare a clear summary to discuss with your care team.</p></div></article></div></> : <><SafetyCard onStart={() => setLoginPrompt(true)} /><div className="section-heading"><div><h3>How MedSafe helps</h3><p className="muted">Clear guidance to help you have a better conversation with your care team.</p></div></div><div className="interaction-grid"><article className="info-banner feature-card"><ShieldCheck size={21} /><div><strong>Understand possible interactions</strong><p>Review medicine and food combinations with plain-language explanations.</p></div></article><article className="info-banner feature-card"><Stethoscope size={21} /><div><strong>Prepare for your appointment</strong><p>Keep a private list and create a clear summary to discuss with your clinician.</p></div></article></div><div className="trust-strip"><div className="trust-icon"><ShieldCheck size={20} /></div><div><strong>Private by design</strong><p>We ask you to sign in before collecting age, condition, or prescription information.</p></div><SpeakButton text="MedSafe asks you to sign in before collecting health information." language={language} /></div></>}</>}{view === "medicines" && <MedicinesView onUpload={() => userEmail ? setUploadOpen(true) : setLoginPrompt(true)} />}{view === "alerts" && <AlertsView onListen={text => showToast(text)} onDoctor={() => userEmail ? setUploadOpen(true) : setLoginPrompt(true)} />}{view === "graph" && <GraphView />}{view === "doctor" && <DoctorView />}</main><footer className="footer"><span>MedSafe</span><span>For informational support only · Not medical advice</span></footer></div>{uploadOpen && <UploadModal close={() => setUploadOpen(false)} />}{loginPrompt && <LoginRequiredModal close={() => setLoginPrompt(false)} openAuth={setAuthMode} />}{logoutPrompt && <LogoutConfirmModal close={() => setLogoutPrompt(false)} confirm={confirmLogout} />}{authMode && <AuthModal mode={authMode} close={() => setAuthMode(null)} onSuccess={handleAuthSuccess} />}{toast && <div className="toast" role="status"><Volume2 size={17} /> {toast}</div>}</div>;
}
