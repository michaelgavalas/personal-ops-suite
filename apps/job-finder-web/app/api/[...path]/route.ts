// Server-side proxy to the api app. The API listens on a unix socket in
// production and is not reachable from the browser at all, so browser traffic
// comes through here.
//
// This is a route handler rather than a `rewrites()` entry because Next
// serializes next.config into required-server-files.json at build time, which
// would bake the API location into the image instead of reading it at boot.

import { apiFetch, apiOrigin } from "@repo/api-client/server";

export const dynamic = "force-dynamic";

// Set by fetch itself from the decoded body; copying the upstream values would
// describe the wrong payload.
const STRIPPED_RESPONSE_HEADERS = ["content-encoding", "content-length"];

async function proxy(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const target = new URL(
    path.map(encodeURIComponent).join("/"),
    `${apiOrigin()}/`,
  );
  target.search = new URL(request.url).search;

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

export {
  proxy as GET,
  proxy as POST,
  proxy as PUT,
  proxy as PATCH,
  proxy as DELETE,
};
