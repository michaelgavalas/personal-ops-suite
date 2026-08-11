import type { AppEnv } from "@repo/api-core";
import { auth } from "@repo/auth/server";
import { Hono } from "hono";

/**
 * HTTP surface for authentication. Better Auth does its own routing from the
 * raw request, so this hands the whole subtree over rather than enumerating
 * endpoints.
 *
 * Mounted at the root of the API rather than under a prefix: Better Auth owns
 * every path beneath /auth, so a sibling route nested there would collide with
 * one of its endpoints.
 */
export const authRoutes = new Hono<AppEnv>().on(
  ["GET", "POST"],
  "/auth/*",
  (c) => auth().handler(c.req.raw),
);
