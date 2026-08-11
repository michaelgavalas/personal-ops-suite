import { createDb } from "@repo/db";
import { accounts, sessions, users, verifications } from "@repo/db/auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

/**
 * Path the auth routes answer on, identical on the API and in the browser
 * because the web app proxies /api/* through without rewriting it. Better Auth
 * matches this against the raw request path, so the two must not diverge.
 */
export const AUTH_BASE_PATH = "/api/auth";

function create() {
  const db = createDb({ users, sessions, accounts, verifications });

  return betterAuth({
    // The public origin, and only the origin — a baseURL carrying a path makes
    // Better Auth match no routes at all. OAuth callbacks and cookie
    // attributes are built from this, so it must be the host the browser sees
    // rather than the api.internal placeholder the socket is dialled with.
    baseURL: process.env.BETTER_AUTH_URL,
    basePath: AUTH_BASE_PATH,
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
