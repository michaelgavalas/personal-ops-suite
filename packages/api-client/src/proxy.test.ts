import { createServer, type IncomingMessage, type Server } from "node:http";
import { gzipSync } from "node:zlib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type Received = {
  url: string;
  method: string;
  headers: IncomingMessage["headers"];
  body: string;
};

/**
 * Stands in for the API. Records what actually arrived — the point of these
 * tests is what the proxy does to a request on the way through, so the
 * upstream's view is the assertion surface.
 */
let received: Received;
let respond: (response: import("node:http").ServerResponse) => void;
let upstream: Server;

// Imported dynamically: the transport in server.ts is resolved once and cached,
// so API_URL has to name a real port before anything touches the module.
let apiProxy: typeof import("./proxy.js").apiProxy;

beforeAll(async () => {
  upstream = createServer((request, response) => {
    const chunks: Buffer[] = [];
    request.on("data", (chunk: Buffer) => chunks.push(chunk));
    request.on("end", () => {
      received = {
        url: request.url ?? "",
        method: request.method ?? "",
        headers: request.headers,
        body: Buffer.concat(chunks).toString(),
      };
      respond(response);
    });
  });

  await new Promise<void>((resolve) =>
    upstream.listen(0, "127.0.0.1", resolve),
  );
  const address = upstream.address();
  if (typeof address === "string" || address === null) {
    throw new Error("expected a TCP address");
  }

  process.env.API_URL = `http://127.0.0.1:${address.port}`;
  // Deleted rather than set to undefined, which assigning would turn into the
  // string "undefined" — truthy, and the transport would pick the socket.
  delete process.env.API_SOCKET_PATH;
  ({ apiProxy } = await import("./proxy.js"));
});

afterAll(() => {
  upstream.close();
});

/** A request as it would arrive at the Next route handler. */
function inbound(path: string, init?: RequestInit) {
  return new Request(`https://jobs.example.com${path}`, init);
}

describe("apiProxy", () => {
  it("forwards the path and query byte for byte", async () => {
    respond = (response) => response.end("ok");

    // A decoded-then-re-encoded path would turn the plus into %2B and the
    // %2B into %252B. Both have to arrive exactly as sent.
    await apiProxy(inbound("/api/jobs/a+b/c%2Bd?q=x+y&r=1"));

    expect(received.url).toBe("/api/jobs/a+b/c%2Bd?q=x+y&r=1");
  });

  it("drops the inbound host header", async () => {
    respond = (response) => response.end("ok");

    await apiProxy(inbound("/api/jobs"));

    // Node fills in the host of the connection it actually opened, which must
    // be the upstream rather than the public domain the browser addressed.
    expect(received.headers.host).not.toBe("jobs.example.com");
  });

  it("carries the caller's cookies through", async () => {
    respond = (response) => response.end("ok");

    await apiProxy(
      inbound("/api/jobs", { headers: { cookie: "session=abc123" } }),
    );

    expect(received.headers.cookie).toBe("session=abc123");
  });

  it("forwards a request body", async () => {
    respond = (response) => response.end("ok");

    await apiProxy(
      inbound("/api/jobs", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ title: "Engineer" }),
      }),
    );

    expect(received.method).toBe("POST");
    expect(JSON.parse(received.body)).toEqual({ title: "Engineer" });
  });

  it("sends no body on GET", async () => {
    respond = (response) => response.end("ok");

    await apiProxy(inbound("/api/jobs"));

    expect(received.body).toBe("");
  });

  it("keeps multiple Set-Cookie headers separate", async () => {
    // Better Auth sets more than one on sign-in. Folding them into a single
    // comma-joined value is the classic way to break it.
    respond = (response) => {
      response.setHeader("set-cookie", [
        "session=abc; Path=/; HttpOnly",
        "csrf=def; Path=/",
      ]);
      response.end("ok");
    };

    const response = await apiProxy(inbound("/api/auth/sign-in"));

    expect(response.headers.getSetCookie()).toEqual([
      "session=abc; Path=/; HttpOnly",
      "csrf=def; Path=/",
    ]);
  });

  it("strips headers that describe the encoded upstream body", async () => {
    const body = gzipSync(Buffer.from("compressed payload"));
    respond = (response) => {
      response.setHeader("content-encoding", "gzip");
      response.setHeader("content-length", String(body.byteLength));
      response.end(body);
    };

    const response = await apiProxy(inbound("/api/jobs"));

    // fetch already decoded the body, so both headers now describe bytes that
    // are no longer being sent.
    expect(response.headers.get("content-encoding")).toBeNull();
    expect(response.headers.get("content-length")).toBeNull();
    expect(await response.text()).toBe("compressed payload");
  });

  it("passes the upstream status through rather than following redirects", async () => {
    respond = (response) => {
      response.writeHead(302, { location: "/api/auth/callback" });
      response.end();
    };

    const response = await apiProxy(inbound("/api/auth/sign-in"));

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe("/api/auth/callback");
  });
});
