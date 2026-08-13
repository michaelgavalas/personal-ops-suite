import { getSessionCookie } from "better-auth/cookies";

/**
 * Whether a request arrives carrying a session cookie.
 *
 * A presence check, not a validation: it reads the cookie without asking the
 * database whether the session behind it is real or still current. That is the
 * point — it is meant for gating navigation at the edge of an app, where the
 * cost of a round trip on every request is not worth paying and the pages
 * behind it do their own checks anyway.
 *
 * Never use it to authorise anything. Anyone can send a cookie; only the API
 * can say whether it means something.
 */
export function hasSessionCookie(request: Request | Headers) {
  return getSessionCookie(request) !== null;
}
