// Auth gate. Named proxy.ts because Next 16 renamed the middleware convention
// — unrelated to the API proxy in app/api, which forwards requests to the api
// app.
//
// Deliberately only a cookie presence check. Validating the session here would
// put an API round trip in front of every navigation, and it would still not
// be the thing that protects data: pages and route handlers authenticate for
// themselves against the API. This exists so a signed-out visitor gets sent to
// the sign-in screen instead of a broken page.

import { hasSessionCookie } from "@repo/auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { REDIRECT_TO, requireOrigin } from "@/lib/origins";

export function proxy(request: NextRequest) {
  if (hasSessionCookie(request)) {
    return NextResponse.next();
  }

  const signIn = new URL("/sign-in", requireOrigin("AUTH_URL"));
  // Built from the configured public origin rather than request.url, which
  // behind Caddy is the internal http://web:3000 address the container was
  // reached on and would send people somewhere unreachable after signing in.
  const destination = new URL(
    `${request.nextUrl.pathname}${request.nextUrl.search}`,
    requireOrigin("APP_URL"),
  );
  signIn.searchParams.set(REDIRECT_TO, destination.toString());

  return NextResponse.redirect(signIn);
}

export const config = {
  // Everything except: the API proxy, which carries session reads and sign-out
  // and so has to stay reachable while signed out; Next's own assets; and the
  // favicon. Without the exclusions this redirects the CSS and JS too.
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};
