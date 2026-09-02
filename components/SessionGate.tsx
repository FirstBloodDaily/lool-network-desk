"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export const VISIT_KEY = "ln_visit";
export const IDLE_AT_KEY = "ln_idle_at";
export const IDLE_MS = 5 * 60 * 1000;

let lastActivity = Date.now();

function stamp() {
  lastActivity = Date.now();
  try {
    sessionStorage.setItem(IDLE_AT_KEY, String(lastActivity));
  } catch {
    /* private mode */
  }
  return lastActivity;
}

function lastAt(): number {
  try {
    const n = Number(sessionStorage.getItem(IDLE_AT_KEY) || "");
    if (Number.isFinite(n) && n > 0) lastActivity = Math.max(lastActivity, n);
  } catch {
    /* ignore */
  }
  return lastActivity;
}

function logoutIdle() {
  try {
    sessionStorage.removeItem(VISIT_KEY);
    sessionStorage.removeItem(IDLE_AT_KEY);
  } catch {
    /* ignore */
  }
  void fetch("/api/auth/logout", { method: "POST" }).finally(() => {
    window.location.replace("/login?idle=1");
  });
}

export default function SessionGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const publicPage = pathname === "/login" || pathname === "/setup";
  const [ready, setReady] = useState(publicPage);

  useEffect(() => {
    if (publicPage) {
      setReady(true);
      return;
    }
    try {
      if (sessionStorage.getItem(VISIT_KEY) !== "1") {
        void fetch("/api/auth/logout", { method: "POST" }).finally(() => {
          window.location.replace("/login");
        });
        return;
      }
    } catch {
      /* private mode */
    }
    if (Date.now() - lastAt() >= IDLE_MS) {
      logoutIdle();
      return;
    }
    setReady(true);
  }, [publicPage]);

  useEffect(() => {
    if (publicPage || !ready) return;

    stamp();
    let timer = 0;

    const schedule = () => {
      window.clearTimeout(timer);
      const left = IDLE_MS - (Date.now() - lastAt());
      timer = window.setTimeout(() => {
        if (Date.now() - lastAt() >= IDLE_MS) logoutIdle();
        else schedule();
      }, Math.max(1000, left));
    };

    const onActivity = () => {
      stamp();
      schedule();
    };

    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastAt() >= IDLE_MS) logoutIdle();
      else schedule();
    };

    const events = ["mousemove", "mousedown", "keydown", "scroll", "touchstart", "wheel", "pointerdown"] as const;
    events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
    document.addEventListener("visibilitychange", onVisible);
    schedule();

    return () => {
      window.clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, onActivity));
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [publicPage, ready]);

  if (!ready) {
    return <div className="auth-page"><div className="muted">Checking access…</div></div>;
  }
  return <>{children}</>;
}
