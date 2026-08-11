import { mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { connect, createServer as createSocketServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { ServerType } from "@hono/node-server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { listen } from "./listen.js";

/** Resolves true if something is accepting connections on the path. */
function canConnect(path: string) {
  return new Promise<boolean>((resolve) => {
    const probe = connect(path);
    const settle = (result: boolean) => {
      probe.destroy();
      resolve(result);
    };
    probe.setTimeout(1000, () => settle(false));
    probe.once("connect", () => settle(true));
    probe.once("error", () => settle(false));
  });
}

function closed(server: ServerType) {
  return new Promise<void>((resolve) => server.close(() => resolve()));
}

describe("listen", () => {
  let directory: string;
  let socketPath: string;
  const opened: ServerType[] = [];

  // listen() installs SIGINT/SIGTERM handlers with process.once, which would
  // accumulate across tests and eventually trip the max-listeners warning.
  // Only the ones a test added are removed — vitest has its own.
  let inheritedSignalListeners: Record<string, unknown[]>;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), "listen-test-"));
    socketPath = join(directory, "api.sock");
    inheritedSignalListeners = {
      SIGINT: process.listeners("SIGINT"),
      SIGTERM: process.listeners("SIGTERM"),
    };
  });

  afterEach(async () => {
    for (const server of opened.splice(0)) {
      await closed(server);
    }
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
      for (const listener of process.listeners(signal)) {
        if (!inheritedSignalListeners[signal].includes(listener)) {
          process.removeListener(signal, listener);
        }
      }
    }
    await rm(directory, { recursive: true, force: true });
    vi.unstubAllEnvs();
  });

  function serve() {
    const server = createServer((_, response) => response.end("ok"));
    opened.push(server);
    return server;
  }

  it("binds a unix socket when API_SOCKET_PATH is set", async () => {
    vi.stubEnv("API_SOCKET_PATH", socketPath);

    await listen(serve());

    expect(await canConnect(socketPath)).toBe(true);
  });

  it("creates the socket owner- and group-only, never world", async () => {
    vi.stubEnv("API_SOCKET_PATH", socketPath);

    await listen(serve());

    // Masking off the file type leaves the permission bits.
    expect((await stat(socketPath)).mode & 0o777).toBe(0o660);
  });

  it("replaces a socket file left behind by a dead process", async () => {
    vi.stubEnv("API_SOCKET_PATH", socketPath);
    await writeFile(socketPath, "");

    await listen(serve());

    expect(await canConnect(socketPath)).toBe(true);
  });

  it("refuses to replace a socket a live process is bound to", async () => {
    vi.stubEnv("API_SOCKET_PATH", socketPath);
    const incumbent = createSocketServer();
    await new Promise<void>((resolve) => incumbent.listen(socketPath, resolve));

    try {
      await expect(listen(serve())).rejects.toThrow(/already served by a live/);
      // The incumbent has to survive the refusal — unlinking it and then
      // failing would take down the server that was answering.
      expect(await canConnect(socketPath)).toBe(true);
    } finally {
      await new Promise<void>((resolve) => incumbent.close(() => resolve()));
    }
  });

  it("binds a TCP port when API_SOCKET_PATH is unset", async () => {
    vi.stubEnv("API_SOCKET_PATH", undefined);
    // 0 lets the OS pick, so the test cannot collide with a real service.
    vi.stubEnv("API_PORT", "0");

    const server = serve();
    await listen(server);

    const address = server.address();
    expect(address).toMatchObject({ port: expect.any(Number) });
  });
});
