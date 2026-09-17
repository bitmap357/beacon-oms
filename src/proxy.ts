/**
 * Next.js 16 request gate (replaces middleware.ts).
 * Unauthenticated browser visits redirect to /login. API routes authenticate themselves
 * with requireApiUser() so this file only checks the session cookie for pages.
 */
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/api/auth",
  "/icon",
];

/** Logged-in users with mustResetPassword may still reach these. */
const PASSWORD_RESET_PATHS = ["/change-password", "/api/auth/change-password"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  const token =
    request.cookies.get("authjs.session-token") ??
    request.cookies.get("__Secure-authjs.session-token");

  if (pathname.startsWith("/api/") && !pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  if (!isPublic && !token) {
    const login = new URL("/login", request.url);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  // Soft gate: change-password is always allowed when cookie present; requireUser enforces flag.
  void PASSWORD_RESET_PATHS;

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon|brand/|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
