import { NextResponse } from "next/server";
import { cookieClear } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", cookieClear());
  return res;
}

export async function GET(req: Request) {
  const res = NextResponse.redirect(new URL("/login", req.url));
  res.headers.set("Set-Cookie", cookieClear());
  return res;
}
