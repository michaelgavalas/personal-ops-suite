/**
 * Path the auth routes answer on, identical on the API and in the browser
 * because the web apps proxy /api/* through without rewriting it. Better Auth
 * matches this against the raw request path, so the two must not diverge.
 *
 * Kept in its own module with no imports, mirroring api/base-path: frontends
 * need the constant to address the API, and reading it from ./server would
 * drag Better Auth and the Drizzle adapter — and with them a database driver —
 * into an app that has no business holding either.
 */
export const AUTH_BASE_PATH = "/api/auth";
