import { getSession, type Session } from "@repo/auth/server";
import { createMiddleware } from "hono/factory";

/**
 * The context every feature router is built against. Routers must share one
 * Env type or their contexts do not compose, and `c.get("session")` silently
 * loses its type — which takes the RPC client's inference down with it.
 */
export type AppEnv = {
  Variables: {
    session: Session | null;
  };
};

/**
 * Resolves the caller's session once per request and puts it on the context.
 *
 * Mount this after the auth routes: those establish a session rather than
 * consume one, so running this first would spend a database round trip on
 * every sign-in for a result nothing reads.
 */
export const sessionMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  c.set("session", await getSession(c.req.raw.headers));
  await next();
});
