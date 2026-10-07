"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function ResetPasswordPage() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const token = new URLSearchParams(window.location.search).get("token");
      if (!token) throw new Error("This reset link is missing its token.");
      const response = await fetch(`${API_URL}/api/auth/reset-password`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "Unable to reset password.");
      setMessage(data.message);
    } catch (requestError) {
      setError(requestError instanceof TypeError ? "Cannot reach the MedSafe API. Start it with `npm run dev:all` and make sure port 8000 is available." : requestError instanceof Error ? requestError.message : "Unable to reset password.");
    } finally {
      setBusy(false);
    }
  };

  return <main className="auth-page"><section className="auth-card"><div className="brand auth-brand"><div className="brand-mark"><img src="/medsafe-logo.svg" alt="" /></div><span>Med<span>Safe</span></span></div><span className="eyebrow">Account recovery</span><h1>Choose a new password</h1><p className="muted">Use at least 8 characters for your new password.</p><form onSubmit={submit}><label>New password<span className="password-field"><input type={showPassword ? "text" : "password"} required minLength={8} autoComplete="new-password" value={password} onChange={event => setPassword(event.target.value)} /><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>{error && <div className="auth-error" role="alert">{error}</div>}{message && <div className="auth-message" role="status">{message}</div>}<button className="button primary full" disabled={busy}>{busy ? "Updating..." : "Update password"} <ArrowRight size={17} /></button></form><Link className="auth-demo" href="/login">Return to sign in</Link></section></main>;
}
