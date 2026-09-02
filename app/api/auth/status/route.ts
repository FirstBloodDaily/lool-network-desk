import { NextResponse } from "next/server";
import { investorPassword, SESSION_COOKIE, verifySession } from "@/lib/auth";
import { googleConfig } from "@/lib/youtube";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { password, setupRequired, usingDevDefault } = investorPassword();
  const cookie = req.headers.get("cookie") || "";
  const match = cookie.split(";").map((s) => s.trim()).find((s) => s.startsWith(SESSION_COOKIE + "="));
  const token = match ? match.slice(SESSION_COOKIE.length + 1) : "";
  const authenticated = !!(password && (await verifySession(token, password)));
  return NextResponse.json({
    ok: true,
    authenticated,
    setupRequired,
    usingDevDefault,
    youtubeConfigured: !!googleConfig(),
    timezone: "GMT+2",
  });
}
