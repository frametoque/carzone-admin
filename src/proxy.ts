import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function proxy(request: NextRequest) {
  const session = request.cookies.get("session")?.value;
  const { pathname } = request.nextUrl;

  // Protect all dashboard paths
  const isProtectedRoute = 
    pathname === "/" ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/income") ||
    pathname.startsWith("/expenses") ||
    pathname.startsWith("/invoices") ||
    pathname.startsWith("/quotations") ||
    pathname.startsWith("/clients") ||
    pathname.startsWith("/reports") ||
    pathname.startsWith("/settings") ||
    pathname.startsWith("/invoice");

  if (isProtectedRoute && !session) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users trying to access login
  if (pathname === "/login" && session) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api/auth (allow auth endpoints)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, logo-trans.png, logo-trans.svg (assets)
     */
    "/((?!api/auth|_next/static|_next/image|favicon.ico|logo-trans.png|logo-trans.svg).*)",
  ],
};
