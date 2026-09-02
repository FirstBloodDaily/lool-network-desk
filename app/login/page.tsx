import { Suspense } from "react";
import { investorPassword } from "@/lib/auth";
import LoginForm from "@/components/LoginForm";
import { redirect } from "next/navigation";

export default function LoginPage() {
  const { setupRequired, usingDevDefault } = investorPassword();
  if (setupRequired) redirect("/setup");

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="kicker">LoL Esports</div>
        <h1>Network desk</h1>
        <p className="muted">Password-gated. 100% network metrics only.</p>
        <Suspense fallback={<p className="muted">Loading…</p>}>
          <LoginForm usingDevDefault={usingDevDefault} />
        </Suspense>
      </div>
    </div>
  );
}
