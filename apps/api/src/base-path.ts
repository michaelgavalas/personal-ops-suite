/**
 * Every route sits under this prefix, matching the path the browser uses. The
 * web app proxies /api/* through unchanged rather than rewriting it, so that
 * Better Auth's callback URLs and cookie paths — which it builds from the
 * public origin — address the same paths this server actually matches.
 *
 * Kept in its own module with no imports: browser bundles read this constant,
 * and pulling it from the app module would drag the server in behind it.
 */
export const API_BASE_PATH = "/api";
