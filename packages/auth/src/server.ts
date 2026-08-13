import { createDb } from "@repo/db";
import { accounts, sessions, users, verifications } from "@repo/db/auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

import { AUTH_BASE_PATH } from "./base-path.js";

// Re-exported so existing importers keep their single entrypoint; apps that
// only need the path should import ./base-path directly and skip this module.
export { AUTH_BASE_PATH };

/**
 * Origins allowed to drive auth besides baseURL itself, as a comma-separated
 * list.
 *
 * The sign-in pages live on their own subdomain, but every other app still
 * proxies /api/auth on its own origin to read the session and sign out. So
 * requests legitimately arrive carrying several different Origin headers, and
 * Better Auth rejects any it was not told to expect.
 */
function trustedOrigins() {
  return (process.env.BETTER_AUTH_TRUSTED_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function create() {
  const cookieDomain = process.env.AUTH_COOKIE_DOMAIN;
  const db = createDb({ users, sessions, accounts, verifications });

  return betterAuth({
    // The public origin, and only the origin — a baseURL carrying a path makes
    // Better Auth match no routes at all. OAuth callbacks and cookie
    // attributes are built from this, so it must be the host the browser sees
    // rather than the api.internal placeholder the socket is dialled with.
    baseURL: process.env.BETTER_AUTH_URL,
    basePath: AUTH_BASE_PATH,
    trustedOrigins: trustedOrigins(),
    // Reads BETTER_AUTH_SECRET from the environment. Set it, or every restart
    // invalidates all existing sessions.
    database: drizzleAdapter(db, {
      provider: "pg",
      // Better Auth addresses its models in the singular; the tables are
      // plural. Mapping them explicitly is unambiguous, where usePlural only
      // rewrites the db.query key and leaves this lookup to a fallback scan.
      schema: {
        user: users,
        session: sessions,
        account: accounts,
        verification: verifications,
      },
    }),
    emailAndPassword: {
      enabled: true,
    },
    advanced: {
      // Sign-in happens on the auth subdomain, but the session it creates has
      // to be readable by every sibling app. Left host-only, signing in would
      // appear to succeed and every other subdomain would still see a logged
      // out visitor. Skipped when unset, which is what development wants:
      // cookies ignore the port, so apps on localhost already share a host.
      ...(cookieDomain && {
        crossSubDomainCookies: { enabled: true, domain: cookieDomain },
      }),
      // A unix socket has no peer address, so without this every caller looks
      // like the same anonymous client and one user's failed logins would rate
      // limit everyone. Caddy sets the header and the web proxy passes it on.
      ipAddress: {
        ipAddressHeaders: ["x-forwarded-for"],
      },
    },
  });
}

let instance: ReturnType<typeof create> | undefined;

/**
 * The Better Auth instance, built on first use rather than at import, so that
 * merely importing this module does not require DATABASE_URL.
 */
export function auth() {
  instance ??= create();
  return instance;
}

export type Auth = ReturnType<typeof create>;
export type Session = Auth["$Infer"]["Session"];

/** Resolves the session for an inbound request, or null when unauthenticated. */
export function getSession(headers: Headers) {
  return auth().api.getSession({ headers });
}
