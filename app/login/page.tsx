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
        <div className="kicker">LoL YouTube network</div>
        <h1>Investor desk</h1>
        <p className="muted">Password-gated. 100% network metrics only. Times in Asia/Nicosia.</p>
        <Suspense fallback={<p className="muted">Loading…</p>}>
          <LoginForm usingDevDefault={usingDevDefault} />
        </Suspense>
      </div>
    </div>
  );
}
