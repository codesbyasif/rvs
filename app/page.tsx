"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity, AlertTriangle, ArrowRight, Check, ChevronDown, CircleHelp, FileText,
  Home as HomeIcon, Info, Languages, Leaf, Menu, Mic, Pill, Play, ShieldCheck,
  Stethoscope, Upload, Volume2, X
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type Severity = "High" | "Moderate" | "Monitor";
type View = "home" | "medicines" | "alerts" | "doctor" | "graph";

const medicines = [
  { name: "Warfarin", dose: "5 mg", frequency: "Once daily", confidence: 96, color: "blue" },
  { name: "Aspirin", dose: "75 mg", frequency: "Once daily", confidence: 94, color: "coral" },
  { name: "Metformin", dose: "500 mg", frequency: "Twice daily", confidence: 99, color: "green" },
  { name: "Atorvastatin", dose: "20 mg", frequency: "At bedtime", confidence: 91, color: "violet" },
  { name: "Amlodipine", dose: "5 mg", frequency: "Once daily", confidence: 98, color: "amber" }
];

const interactions: { severity: Severity; title: string; detail: string; kind: string; icon: "alert" | "leaf" }[] = [
  { severity: "High", title: "Warfarin + Aspirin", detail: "Taking these medicines together can increase the chance of bleeding.", kind: "Medicine–medicine", icon: "alert" },
  { severity: "Moderate", title: "Warfarin + leafy greens", detail: "Large changes in vitamin K intake may affect how well warfarin works.", kind: "Medicine–food", icon: "leaf" }
];

const navItems: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Home", icon: HomeIcon }, { id: "medicines", label: "My medicines", icon: Pill },
  { id: "alerts", label: "Safety alerts", icon: AlertTriangle }, { id: "doctor", label: "Doctor summary", icon: Stethoscope },
  { id: "graph", label: "Interaction graph", icon: Activity }
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

function Sidebar({ view, setView, language, setLanguage }: { view: View; setView: (v: View) => void; language: "en-IN" | "hi-IN"; setLanguage: (l: "en-IN" | "hi-IN") => void }) {
  return <aside className="sidebar" id="main-navigation">
    <div className="brand"><div className="brand-mark"><ShieldCheck size={22} /></div><span>Med<span>Safe</span></span></div>
    <div className="demo-badge"><span /> Demo workspace</div>
    <nav aria-label="Main navigation">{navItems.map(({ id, label, icon: Icon }) =>
      <button key={id} className={`nav-item ${view === id ? "active" : ""}`} onClick={() => setView(id)}><Icon size={19} /><span>{label}</span>{id === "alerts" && <b>2</b>}</button>)}</nav>
    <div className="sidebar-bottom">
      <div className="help-card"><CircleHelp size={20} /><div><strong>Need help?</strong><small>Talk through your results</small></div><ArrowRight size={16} /></div>
      <button className="voice-link"><Mic size={18} /> Voice assistance <span className="status-dot" /></button>
      <div className="language-row"><Languages size={17} /><button className={language === "en-IN" ? "selected" : ""} onClick={() => setLanguage("en-IN")}>English</button><span>/</span><button className={language === "hi-IN" ? "selected" : ""} onClick={() => setLanguage("hi-IN")}>हिन्दी</button></div>
    </div>
  </aside>;
}

function Header({ onMenu, menuOpen, setView }: { onMenu: () => void; menuOpen: boolean; setView: (v: View) => void }) {
  return <header className="topbar"><button className="mobile-menu" onClick={onMenu} aria-label={menuOpen ? "Close navigation" : "Open navigation"} aria-expanded={menuOpen} aria-controls="main-navigation"><Menu /></button><div className="breadcrumb">My health <span>/</span> <strong>Medication safety</strong></div><div className="top-actions"><button className="icon-button" aria-label="Help"><CircleHelp size={20} /></button><button className="profile" onClick={() => setView("doctor")}><span className="avatar">RK</span><span className="profile-text"><strong>Ramesh Kumar</strong><small>Demo patient <ChevronDown size={13} /></small></span></button></div></header>;
}

function SafetyCard({ onViewAlerts, onReviewMedicines }: { onViewAlerts: () => void; onReviewMedicines: () => void }) {
  return <section className="safety-card">
    <div className="safety-main"><div className="eyebrow"><span className="pulse-dot" /> Medication safety check</div><h1>Good morning, Ramesh</h1><p className="muted intro">Here is what we found in your current medicines.</p>
      <div className="status-line"><div className="status-icon"><AlertTriangle size={23} /></div><div><strong>2 things need attention</strong><span>We found interactions worth discussing with your doctor.</span></div></div>
      <div className="safety-actions"><button className="button primary" onClick={onViewAlerts}>See what needs attention <ArrowRight size={17} /></button><button className="button secondary" onClick={onReviewMedicines}>Review my medicines</button></div>
    </div>
    <div className="safety-ring"><div className="ring"><div><strong>3</strong><span>of 5<br />checked</span></div></div><small>Last checked today, 9:42 AM</small></div>
  </section>;
}

function InteractionCard({ item, onListen }: { item: typeof interactions[number]; onListen: (text: string) => void }) {
  const high = item.severity === "High";
  return <article className={`interaction-card ${high ? "high" : "moderate"}`}><div className="interaction-heading"><div className={`severity-icon ${high ? "red" : "amber"}`}>{item.icon === "leaf" ? <Leaf size={21} /> : <AlertTriangle size={21} />}</div><div><span className={`severity-label ${high ? "red-text" : "amber-text"}`}>{item.severity} attention</span><h3>{item.title}</h3></div><span className="kind-pill">{item.kind}</span></div><p>{item.detail}</p><div className="interaction-footer"><button className="text-button" onClick={() => onListen(item.detail)}><Play size={14} fill="currentColor" /> Hear this explanation</button><button className="text-button">Why am I seeing this? <ArrowRight size={14} /></button></div></article>;
}

function MedicinesView({ onUpload }: { onUpload: () => void }) {
  return <><div className="page-heading"><div><span className="eyebrow">Your current list</span><h2>My medicines</h2><p className="muted">5 medicines in this demo profile · <span className="demo-text">Demo data</span></p></div><button className="button primary" onClick={onUpload}><Upload size={17} /> Add prescription</button></div><div className="medicine-list">{medicines.map(m => <div className="medicine-row" key={m.name}><div className={`medicine-icon ${m.color}`}><Pill size={20} /></div><div className="medicine-name"><strong>{m.name}</strong><span>{m.dose} · {m.frequency}</span></div><div className="confidence"><span>OCR confidence</span><strong className={m.confidence < 94 ? "warning" : ""}>{m.confidence}%</strong></div><button className="row-action" aria-label={`Edit ${m.name}`}><ChevronDown size={18} /></button></div>)}</div><div className="info-banner"><Info size={19} /><div><strong>Keep this list up to date</strong><p>Always check your list after a new prescription or dose change.</p></div></div></>;
}

function AlertsView({ onListen, onDoctor }: { onListen: (text: string) => void; onDoctor: () => void }) {
  return <><div className="page-heading"><div><span className="eyebrow">Review together</span><h2>Safety alerts</h2><p className="muted">These are not diagnoses. They are prompts for a clinician review.</p></div><button className="button secondary" onClick={onDoctor}><FileText size={17} /> Show my doctor</button></div><div className="alert-stack">{interactions.map((item, i) => <InteractionCard key={i} item={item} onListen={onListen} />)}</div><div className="safe-note"><Check size={19} /><p><strong>No known interaction found</strong> for Metformin + Amlodipine in the current demo dataset.</p></div><div className="clinical-note"><Stethoscope size={19} /><div><strong>Important</strong><p>Do not stop or change a medicine based on this tool. Talk to your doctor or pharmacist first.</p></div></div></>;
}

function GraphView() {
  return <><div className="page-heading"><div><span className="eyebrow">Verified relationships</span><h2>Interaction graph</h2><p className="muted">See why a medicine or food was flagged.</p></div><div className="verified"><Check size={15} /> Demo knowledge graph</div></div><div className="graph-panel"><div className="graph-canvas"><div className="graph-node drug warfarin"><Pill size={17} />Warfarin</div><div className="graph-node drug aspirin"><Pill size={17} />Aspirin</div><div className="graph-node outcome"><AlertTriangle size={16} />Increased bleeding risk</div><div className="graph-node food"><Leaf size={17} />Leafy greens</div><div className="graph-node outcome vitamin">Vitamin K</div><svg viewBox="0 0 680 410" preserveAspectRatio="none" aria-label="Interaction connections"><path d="M230 95 L430 95" /><path d="M510 120 L510 175" /><path d="M180 270 L180 330" /><path d="M245 350 L400 350" /></svg><span className="edge-label edge-one">high interaction</span><span className="edge-label edge-two">can increase</span><span className="edge-label edge-three">contains</span></div><aside className="why-panel"><span className="eyebrow">Why was this flagged?</span><h3>Warfarin + Aspirin</h3><div className="detail-row"><span>Severity</span><strong className="red-text">High</strong></div><div className="detail-row"><span>Type</span><strong>Medicine–medicine</strong></div><div className="detail-row"><span>Evidence</span><strong>Demo source</strong></div><div className="detail-row"><span>Last verified</span><strong>7 Oct 2026</strong></div><p className="source-note">Demo interaction — replace with a validated source before clinical use.</p></aside></div></>;
}

function DoctorView() {
  return <><div className="page-heading"><div><span className="eyebrow">Ready to share</span><h2>Doctor summary</h2><p className="muted">A clear starting point for your next appointment.</p></div><button className="button primary"><FileText size={17} /> Download summary</button></div><div className="summary-paper"><div className="summary-top"><div className="brand small-brand"><div className="brand-mark"><ShieldCheck size={18} /></div><span>Med<span>Safe</span></span></div><span className="summary-date">Prepared 7 Oct 2026</span></div><h3>Medication review for Ramesh Kumar</h3><p className="muted">68 years · Demo patient profile</p><hr /><h4>Current medicines <span>5</span></h4><div className="summary-meds">{medicines.map(m => <div key={m.name}><strong>{m.name}</strong><span>{m.dose}, {m.frequency}</span></div>)}</div><h4>Questions for clinician review <span className="red-badge">2</span></h4><ul><li>Review whether concurrent Warfarin and Aspirin therapy remains clinically indicated.</li><li>Discuss how to keep vitamin K-rich food intake consistent.</li></ul><div className="summary-disclaimer"><Info size={17} /><span>Generated from demo interaction data. This is not a prescription or diagnosis.</span></div></div></>;
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

  return <div className="modal-backdrop" role="presentation"><div className="modal" role="dialog" aria-modal="true" aria-labelledby="upload-title"><button className="modal-close" onClick={close} aria-label="Close"><X size={20} /></button>{step === "upload" ? <><div className="eyebrow">Step 1 of 3</div><h2 id="upload-title">Upload your prescription</h2><p className="muted">Choose a clear photo or PDF. You will review what we find before checking interactions.</p><label className={`upload-zone ${dragging ? "dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); acceptFile(event.dataTransfer.files[0]); }}><input className="file-input" type="file" accept="image/jpeg,image/png,application/pdf" onChange={(event) => acceptFile(event.target.files?.[0])} /><div className="upload-icon"><Upload size={25} /></div><strong>{file ? "Prescription ready to review" : "Drop a prescription here"}</strong><span>{file ? file.name : "or choose a clear photo or PDF"}</span><span className="button primary"><Upload size={17} /> {file ? "Choose another file" : "Choose file"}</span><small>JPG, PNG or PDF · Max 10 MB</small></label>{error && <div className="upload-error" role="alert"><AlertTriangle size={17} />{error}</div>}{file && <div className="file-preview">{previewUrl ? <img src={previewUrl} alt="Selected prescription preview" /> : <FileText size={21} />}<div><strong>{file.name}</strong><span>{(file.size / 1024 / 1024).toFixed(2)} MB · Ready for demo OCR review</span></div><Check size={19} /></div>}<div className="privacy-note"><ShieldCheck size={17} /><span>Your prescription stays private in this demo.</span></div>{file && <button className="button primary full" onClick={() => setStep("review")}>Review medicines found <ArrowRight size={17} /></button>}</> : <><div className="eyebrow">Step 2 of 3</div><h2 id="upload-title">Review medicines found</h2><p className="muted">We read these from your prescription. Please check each one before continuing.</p><div className="review-list">{medicines.slice(0, 3).map(m => <div className="review-row" key={m.name}><div><strong>{m.name}</strong><span>{m.dose} · {m.frequency}</span></div><span className="confidence good">{m.confidence}% match</span></div>)}</div><div className="low-confidence"><AlertTriangle size={18} /><div><strong>Please check this medicine name</strong><p>Atorvastatin was harder to read. Confirm it before checking interactions.</p></div></div><button className="button primary full" onClick={close}>Check interactions <ArrowRight size={17} /></button></>}</div></div>;
}

export default function Home() {
  const [view, setView] = useState<View>("home");
  const [language, setLanguage] = useState<"en-IN" | "hi-IN">("en-IN");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const showToast = (text: string) => { setToast(text); window.setTimeout(() => setToast(""), 2500); };
  const selectView = (next: View) => { setView(next); setMobileNav(false); };
  return <div className="app-shell"><div className={`mobile-overlay ${mobileNav ? "open" : ""}`} onClick={() => setMobileNav(false)} /><div className={`sidebar-wrap ${mobileNav ? "open" : ""}`}><Sidebar view={view} setView={selectView} language={language} setLanguage={setLanguage} /></div><div className="main-shell"><Header onMenu={() => setMobileNav(!mobileNav)} menuOpen={mobileNav} setView={selectView} /><main className="content">{view === "home" && <><div className="welcome-row"><div><span className="eyebrow">Tuesday, 7 October 2026</span><h2>Your medication safety</h2></div><div className="welcome-actions"><Link className="button secondary" href="/doctor-signup"><Stethoscope size={17} /> Doctor? Join MedSafe</Link><button className="button secondary upload-top" onClick={() => setUploadOpen(true)}><Upload size={17} /> Upload prescription</button></div></div><SafetyCard onViewAlerts={() => setView("alerts")} onReviewMedicines={() => setView("medicines")} /><div className="section-heading"><div><h3>Needs your attention</h3><p className="muted">A quick look at the most important findings.</p></div><button className="text-button" onClick={() => setView("alerts")}>View all alerts <ArrowRight size={15} /></button></div><div className="interaction-grid">{interactions.map((item, i) => <InteractionCard key={i} item={item} onListen={text => showToast(text)} />)}</div><div className="trust-strip"><div className="trust-icon"><ShieldCheck size={20} /></div><div><strong>Built for a conversation, not a decision</strong><p>MedSafe explains verified demo data in plain language. Always check with your doctor or pharmacist.</p></div><SpeakButton text="MedSafe is built for a conversation, not a decision." language={language} /></div><div className="admin-home-link"><Link href="/admin"><ShieldCheck size={15} /> Admin review</Link></div></>}{view === "medicines" && <MedicinesView onUpload={() => setUploadOpen(true)} />}{view === "alerts" && <AlertsView onListen={text => showToast(text)} onDoctor={() => setView("doctor")} />}{view === "graph" && <GraphView />}{view === "doctor" && <DoctorView />}</main><footer className="footer"><span>MedSafe prototype</span><span>For demonstration only · Not medical advice</span></footer></div>{uploadOpen && <UploadModal close={() => setUploadOpen(false)} />}{toast && <div className="toast" role="status"><Volume2 size={17} /> {toast}</div>}</div>;
}
