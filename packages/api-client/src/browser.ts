import type { AppType } from "api";
import { hc } from "hono/client";

/**
 * Typed RPC client for client components. The API has no route in from the
 * internet, so this talks to the Next proxy at /api, which forwards over
 * whichever transport the server is configured for.
 *
 * The relative base is fine for requests — fetch resolves it against the
 * document. Only the $url() and $path() helpers need an absolute base.
 */
export const api = hc<AppType>("/api");
