import { NextResponse, type NextRequest } from "next/server";
import { investorPassword, SESSION_COOKIE, verifySession } from "./lib/auth";

const PUBLIC_EXACT = new Set(["/login", "/setup"]);
const PUBLIC_PREFIX = ["/api/auth/login", "/api/auth/status"];

function isPublic(pathname: string): boolean {
  if (PUBLIC_EXACT.has(pathname)) return true;
  if (PUBLIC_PREFIX.some((p) => pathname === p || pathname.startsWith(p + "/"))) return true;
  if (pathname.startsWith("/_next")) return true;
  if (pathname === "/favicon.ico" || pathname === "/robots.txt") return true;
  return false;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const { password, setupRequired } = investorPassword();

  if (setupRequired || !password) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "INVESTOR_PASSWORD is not set. Refusing to serve data in production. Add it in Vercel env vars.",
        },
        { status: 503 },
      );
    }
    return NextResponse.redirect(new URL("/setup", req.url));
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const ok = await verifySession(token, password);
  if (!ok) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: "Not authenticated." }, { status: 401 });
    }
    const login = new URL("/login", req.url);
    if (pathname !== "/") login.searchParams.set("next", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
