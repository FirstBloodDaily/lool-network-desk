import { investorPassword } from "@/lib/auth";
import { redirect } from "next/navigation";

export default function SetupPage() {
  const { setupRequired } = investorPassword();
  if (!setupRequired) redirect("/login");

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="kicker">Setup required</div>
        <h1>Network desk is not configured</h1>
        <p className="muted">
          Production refuses to serve metrics until the password env var is set on the host.
        </p>
        <div className="banner" style={{ marginTop: 18 }}>
          Vercel team Buv Hobby, project lol-network-desk: add the vars from env.example, then redeploy.
        </div>
        <p className="muted" style={{ marginTop: 16 }}>
          Local development uses the documented default when that env var is unset. See README.
        </p>
      </div>
    </div>
  );
}
