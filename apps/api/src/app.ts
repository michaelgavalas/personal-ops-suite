import { authRoutes } from "@repo/api-auth";
import { type AppEnv, sessionMiddleware } from "@repo/api-core";
import { Hono } from "hono";
import { API_BASE_PATH } from "./base-path.js";

// Composition only — routes belong to their feature package. Order matters:
// the auth routes are registered before the session middleware so that signing
// in does not first spend a query resolving the session it is about to create.
const routes = new Hono<AppEnv>()
  .route("/", authRoutes)
  .use("*", sessionMiddleware)
  .get("/", (c) => c.text("Hello Hono!"));

export const app = new Hono().route(API_BASE_PATH, routes);

// Deliberately the unmounted routes: the client pairs this with a base URL
// that already carries the prefix, so paths stay relative on both sides.
export type AppType = typeof routes;
