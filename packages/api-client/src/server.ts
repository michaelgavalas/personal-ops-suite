import type { AppType } from "api";
import { hc } from "hono/client";
import { Agent, fetch as undiciFetch } from "undici";

// When a socket carries the request the dispatcher decides where it goes, but
// fetch still has to parse the URL, so the host is a placeholder that never
// resolves.
const SOCKET_ORIGIN = "http://api.internal";

type Transport = {
  origin: string;
  fetch: typeof globalThis.fetch;
};

let transport: Transport | undefined;

function resolveTransport(): Transport {
  const socketPath = process.env.API_SOCKET_PATH;
  if (socketPath) {
    // One Agent for the process: it owns the connection pool, so building a new
    // one per request would open a fresh socket every time and never reuse it.
    const dispatcher = new Agent({ connect: { socketPath } });
    return {
      origin: SOCKET_ORIGIN,
      // undici's own fetch rather than the global: a standalone Agent and the
      // undici bundled inside Node are separate instances, and the global fetch
      // rejects a dispatcher it does not recognise.
      fetch: ((input, init) =>
        undiciFetch(
          input as never,
          {
            ...init,
            dispatcher,
          } as never,
        )) as typeof globalThis.fetch,
    };
  }

  const origin = process.env.API_URL;
  if (!origin) {
    throw new Error("Set API_SOCKET_PATH or API_URL to reach the API");
  }
  return { origin, fetch: globalThis.fetch };
}

// Resolved on first call rather than at import. Next evaluates module scope
// during the build, where neither variable is set yet.
function get(): Transport {
  transport ??= resolveTransport();
  return transport;
}

/** Absolute origin for the API, for callers that build their own requests. */
export function apiOrigin() {
  return get().origin;
}

/** fetch bound to whichever transport this environment uses. */
export function apiFetch(...args: Parameters<typeof globalThis.fetch>) {
  return get().fetch(...args);
}

let client: ReturnType<typeof hc<AppType>> | undefined;

/**
 * Typed RPC client for use on the server — Server Components, route handlers,
 * server actions. Client components want the browser entrypoint instead.
 */
export function apiClient() {
  client ??= hc<AppType>(get().origin, { fetch: apiFetch });
  return client;
}
