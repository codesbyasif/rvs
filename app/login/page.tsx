"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, Eye, EyeOff, ShieldCheck } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("mode") === "signup") setMode("signup");
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const endpoint = mode === "forgot" ? "forgot-password" : mode;
    try {
      const response = await fetch(`${API_URL}/api/auth/${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "forgot" ? { email } : { email, password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail ?? "Something went wrong.");
      if (mode === "forgot") {
        setMessage(data.development_reset_token ? `Development reset token: ${data.development_reset_token}` : data.message);
      } else {
        localStorage.setItem("medsafe_access_token", data.access_token);
        setMessage("Account verified. You can now return to MedSafe.");
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to complete request.");
    } finally {
      setBusy(false);
    }
  };

  return <main className="auth-page"><div className="auth-background" aria-hidden="true"><div className="auth-background-top"><strong>Med<span>Safe</span></strong><span>Private medication support</span></div><div className="auth-background-content"><span className="eyebrow">Medication safety check</span><h2>Understand your medicines</h2><p>Check possible medicine and food interactions in one clear place.</p><div className="auth-background-grid"><div><strong>01</strong><span>Clear guidance</span></div><div><strong>02</strong><span>Private by design</span></div></div></div></div><div className="auth-overlay" /><section className="auth-card"><div className="brand auth-brand"><div className="brand-mark"><ShieldCheck size={22} /></div><span>Med<span>Safe</span></span></div><span className="eyebrow">{mode === "signup" ? "Create your account" : mode === "forgot" ? "Account recovery" : "Secure sign in"}</span><h1>{mode === "signup" ? "Start your safety journey" : mode === "forgot" ? "Reset your password" : "Welcome back"}</h1><p className="muted">{mode === "forgot" ? "Enter your email and we will send reset instructions." : "Access your medication safety workspace securely."}</p><form onSubmit={submit}><label>Email address<input type="email" required autoComplete="email" value={email} onChange={event => setEmail(event.target.value)} placeholder="you@example.com" /></label>{mode !== "forgot" && <label>Password<span className="password-field"><input type={showPassword ? "text" : "password"} required minLength={8} autoComplete={mode === "signup" ? "new-password" : "current-password"} value={password} onChange={event => setPassword(event.target.value)} placeholder="At least 8 characters" /><button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"}>{showPassword ? <EyeOff size={18} /> : <Eye size={18} />}</button></span></label>}{error && <div className="auth-error" role="alert">{error}</div>}{message && <div className="auth-message" role="status">{message}</div>}<button className="button primary full" disabled={busy}>{busy ? "Please wait..." : mode === "signup" ? "Create account" : mode === "forgot" ? "Send reset instructions" : "Sign in"} <ArrowRight size={17} /></button></form><div className="auth-links">{mode === "login" && <><button onClick={() => setMode("forgot")}>Forgot password?</button><button onClick={() => setMode("signup")}>Create an account</button></>}{mode !== "login" && <button onClick={() => setMode("login")}>Back to sign in</button>}</div><Link className="auth-demo" href="/">Continue to demo without signing in</Link></section></main>;
}
