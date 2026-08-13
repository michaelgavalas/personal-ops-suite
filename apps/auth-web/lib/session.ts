import { apiFetch, apiOrigin } from "@repo/api-client/server";
import { AUTH_BASE_PATH } from "@repo/auth/base-path";
import { hasSessionCookie } from "@repo/auth/cookies";

/**
 * Whether the request comes from someone already signed in.
 *
 * Two steps, because the cheap one is wrong on its own. A cookie can outlive
 * the session it names — revoked elsewhere, expired server-side, or invalidated
 * wholesale by a change of BETTER_AUTH_SECRET — and treating its mere presence
 * as proof would bounce that person to an app whose own gate also only checks
 * presence. They would land on a page that cannot see a session, so it offers
 * no way to sign out, and they could not get back here to sign in again. The
 * only exit would be clearing cookies by hand.
 *
 * So the cookie is used only to decide whether asking is worth it: no cookie
 * means definitely signed out, which is the ordinary case and costs nothing.
 * A cookie means ask the API, which in production is a unix socket away.
 */
export async function isSignedIn(headers: Headers) {
  if (!hasSessionCookie(headers)) {
    return false;
  }

  const cookie = headers.get("cookie");
  if (!cookie) {
    return false;
  }

  try {
    const response = await apiFetch(
      new URL(`${apiOrigin()}${AUTH_BASE_PATH}/get-session`),
      { headers: { cookie } },
    );
    if (!response.ok) {
      return false;
    }
    // Better Auth answers 200 with a null body for a cookie it does not
    // recognise, so the status alone does not settle it.
    return (await response.json()) !== null;
  } catch {
    // The API being unreachable is not evidence of anything. Showing the form
    // fails toward the screen someone can still act on.
    return false;
  }
}
