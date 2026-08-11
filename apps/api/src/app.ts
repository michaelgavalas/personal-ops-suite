import { auth, getSession, type Session } from "@repo/auth/server";
import { Hono } from "hono";
import { API_BASE_PATH } from "./base-path.js";

type Variables = {
  session: Session | null;
};

const routes = new Hono<{ Variables: Variables }>()
  // Mounted before the session middleware: these endpoints establish the
  // session rather than consuming it, and Better Auth does its own routing
  // from the raw request.
  .on(["GET", "POST"], "/auth/*", (c) => auth().handler(c.req.raw))
  .use("*", async (c, next) => {
    c.set("session", await getSession(c.req.raw.headers));
    await next();
  })
  .get("/", (c) => c.text("Hello Hono!"))
  .get("/me", (c) => {
    const session = c.get("session");
    if (!session) {
      return c.json({ error: "unauthenticated" }, 401);
    }
    return c.json({ user: session.user });
  });

export const app = new Hono().route(API_BASE_PATH, routes);

// Deliberately the unmounted routes: the client pairs this with a base URL
// that already carries the prefix, so paths stay relative on both sides.
export type AppType = typeof routes;
