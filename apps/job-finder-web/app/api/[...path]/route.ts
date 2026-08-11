// Server-side proxy to job-finder-api. The API is only reachable on the private
// Docker network, so the browser talks to it through here rather than directly.
//
// This is a route handler rather than a `rewrites()` entry because Next
// serializes next.config into required-server-files.json at build time, which
// would bake JOB_FINDER_API_URL into the image instead of reading it at boot.

export const dynamic = "force-dynamic";

// Set by fetch itself from the decoded body; copying the upstream values would
// describe the wrong payload.
const STRIPPED_RESPONSE_HEADERS = ["content-encoding", "content-length"];

async function proxy(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const apiUrl = process.env.JOB_FINDER_API_URL;
  if (!apiUrl) {
    return new Response("JOB_FINDER_API_URL is not set", { status: 500 });
  }

  const { path } = await params;
  const target = new URL(path.map(encodeURIComponent).join("/"), `${apiUrl}/`);
  target.search = new URL(request.url).search;

  const headers = new Headers(request.headers);
  headers.delete("host");

  const hasBody = request.method !== "GET" && request.method !== "HEAD";
  const response = await fetch(target, {
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
