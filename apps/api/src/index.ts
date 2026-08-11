import { createAdaptorServer } from "@hono/node-server";
import { app } from "./app.js";
import { listen } from "./listen.js";

// createAdaptorServer rather than serve(): serve() hardcodes listen(port,
// hostname), which has no way to express a unix socket path. This returns the
// same server unlistened, so listen() can choose the transport.
await listen(createAdaptorServer({ fetch: app.fetch }));
