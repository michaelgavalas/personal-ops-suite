import { apiFetch, apiOrigin } from "./server.js";

// Set by fetch itself from the decoded body; copying the upstream values would
// describe the wrong payload.
const STRIPPED_RESPONSE_HEADERS = ["content-encoding", "content-length"];

/**
 * Forwards a Next route handler's request to the API and returns its response.
 *
 * The API is not reachable from the browser — in production it listens on a
 * unix socket with no network presence — so every frontend needs this, and it
 * carries auth traffic along with everything else.
 *
 * The path goes through untouched. Reading it from the request rather than the
 * route's params keeps the bytes the client actually sent: params arrive
 * decoded, and re-encoding them rewrites `a+b` to `a%2Bb`. It also means the
 * handler does not care what the catch-all segment is called.
 *
 * Mount it under a path the API also serves, which is what makes the
 * pass-through correct rather than merely convenient.
 */
export async function apiProxy(request: Request): Promise<Response> {
  const incoming = new URL(request.url);
  const target = new URL(
    `${apiOrigin()}${incoming.pathname}${incoming.search}`,
  );

  const headers = new Headers(request.headers);
  headers.delete("host");

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const response = await apiFetch(target, {
    method: request.method,
    headers,
    // Buffered rather than streamed, which keeps this off fetch's duplex path.
    // Revisit if an endpoint ever takes large uploads.
    body: hasBody ? await request.arrayBuffer() : undefined,
    redirect: "manual",
  });

  // Copied as a Headers object rather than read field by field: multiple
  // Set-Cookie headers survive this, where headers.get("set-cookie") would
  // fold them into one comma-joined value and break sign-in.
  const responseHeaders = new Headers(response.headers);
  for (const header of STRIPPED_RESPONSE_HEADERS) {
    responseHeaders.delete(header);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: responseHeaders,
  });
}
