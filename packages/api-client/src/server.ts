import type { AppType } from "api";
import { API_BASE_PATH } from "api/base-path";
import { hc } from "hono/client";
import { Agent, fetch as undiciFetch } from "undici";

export { API_BASE_PATH };

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

// Carried from the inbound request so the API can authenticate the end user
// rather than seeing an anonymous server-to-server call. Deliberately a short
// list: forwarding wholesale would leak host, connection and content-length
// from a request whose body is not the one being sent.
const FORWARDED_HEADERS = ["cookie", "authorization"];

/**
 * Typed RPC client for use on the server — Server Components, route handlers,
 * server actions. Client components want the browser entrypoint instead.
 *
 * Pass the inbound request's headers to call the API as the signed-in user;
 * omit them for genuinely anonymous calls. Nothing is forwarded implicitly,
 * because a Server Component has no ambient request the package can read.
 */
export function apiClient(inbound?: Headers) {
  const headers: Record<string, string> = {};
  for (const name of FORWARDED_HEADERS) {
    const value = inbound?.get(name);
    if (value) {
      headers[name] = value;
    }
  }

  // Rebuilt per call rather than memoised, since the headers differ per
  // request. Only the transport is worth caching — it owns the connection
  // pool, and hc itself is a proxy object that costs nothing to construct.
  return hc<AppType>(`${get().origin}${API_BASE_PATH}`, {
    fetch: apiFetch,
    headers,
  });
}
