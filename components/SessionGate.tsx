"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

export const VISIT_KEY = "ln_visit";

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
      if (sessionStorage.getItem(VISIT_KEY) === "1") {
        setReady(true);
        return;
      }
    } catch {
      /* private mode */
    }
    void fetch("/api/auth/logout", { method: "POST" }).finally(() => {
      window.location.replace("/login");
    });
  }, [publicPage]);

  if (!ready) {
    return <div className="auth-page"><div className="muted">Checking access…</div></div>;
  }
  return <>{children}</>;
}
