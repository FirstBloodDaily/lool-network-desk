"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IDLE_AT_KEY, VISIT_KEY } from "./SessionGate";

export default function LoginForm({ usingDevDefault }: { usingDevDefault: boolean }) {
  const router = useRouter();
  const params = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const idleOut = params.get("idle") === "1";

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const json = (await res.json()) as { ok: boolean; error?: string };
      if (!json.ok) {
        setError(json.error || "Wrong password.");
        return;
      }
      try {
        sessionStorage.setItem(VISIT_KEY, "1");
        sessionStorage.setItem(IDLE_AT_KEY, String(Date.now()));
      } catch { /* ignore */ }
      const next = params.get("next") || "/";
      router.replace(next.startsWith("/") ? next : "/");
      router.refresh();
    } catch {
      setError("Could not reach the login API.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit}>
      {idleOut ? <div className="banner">Signed out after 5 minutes idle.</div> : null}
      {usingDevDefault ? (
        <div className="banner">Local dev default password is <code>dev</code>. Set the site password env var for anything shared.</div>
      ) : null}
      <label className="kicker" htmlFor="password">Password</label>
      <input
        id="password"
        name="password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        required
      />
      {error ? <div className="err">{error}</div> : null}
      <button className="btn btn-primary" type="submit" disabled={busy}>
        {busy ? "Checking…" : "Enter desk"}
      </button>
    </form>
  );
}
