import { Hono } from "hono";

// Routes are chained rather than registered one statement at a time: hc's type
// inference reads the return type of the chain, and a route added on its own
// statement is invisible to the client.
export const app = new Hono().get("/", (c) => c.text("Hello Hono!"));

export type AppType = typeof app;
