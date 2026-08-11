import type { AppType } from "api";
// Value import, so it must come from the leaf module rather than the app —
// importing it from "api" would pull the server into the browser bundle.
import { API_BASE_PATH } from "api/base-path";
import { hc } from "hono/client";

/**
 * Typed RPC client for client components. The API has no route in from the
 * internet, so this talks to the Next proxy at /api, which forwards over
 * whichever transport the server is configured for.
 *
 * The relative base is fine for requests — fetch resolves it against the
 * document. Only the $url() and $path() helpers need an absolute base.
 */
export const api = hc<AppType>(API_BASE_PATH);
