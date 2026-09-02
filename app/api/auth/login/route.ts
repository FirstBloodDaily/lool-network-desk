import { NextResponse } from "next/server";
import { cookieSerialize, investorPassword, mintSession, passwordMatches } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: Request) {
  const { password: expected, setupRequired } = investorPassword();
  if (setupRequired || !expected) {
    return NextResponse.json(
      {
        ok: false,
        error: "INVESTOR_PASSWORD is not set. This desk will not serve data until it is configured.",
      },
      { status: 503 },
    );
  }

  let given = "";
  const ct = req.headers.get("content-type") || "";
  try {
    if (ct.includes("application/json")) {
      const body = (await req.json()) as { password?: string };
      given = String(body.password || "");
    } else {
      const form = await req.formData();
      given = String(form.get("password") || "");
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Could not read password." }, { status: 400 });
  }

  if (!passwordMatches(given, expected)) {
    return NextResponse.json({ ok: false, error: "Wrong password." }, { status: 401 });
  }

  const token = await mintSession(expected);
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", cookieSerialize(token));
  return res;
}
