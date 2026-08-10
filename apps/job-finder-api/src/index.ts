import { serve } from "@hono/node-server";
import { Hono } from "hono";

const app = new Hono();

app.get("/", (c) => {
  return c.text("Hello Hono!");
});

serve(
  {
    fetch: app.fetch,
    port: Number(process.env.JOB_FINDER_API_PORT ?? 5000),
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  },
);
