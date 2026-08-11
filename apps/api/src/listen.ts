import { chmod, unlink } from "node:fs/promises";
import { connect, type ListenOptions } from "node:net";
import type { ServerType } from "@hono/node-server";

// Owner and group, never world. Both containers run as uid 1000 so owner alone
// would be enough; the group bit leaves room for a sidecar on a shared gid.
const SOCKET_MODE = 0o660;

// A stale socket refuses the connection immediately, so this only bounds the
// pathological case where the path exists but nothing ever answers.
const PROBE_TIMEOUT_MS = 1000;

/**
 * Distinguishes a socket left behind by a killed process from one a live server
 * is still bound to. Connecting is the only reliable test — the file looks
 * identical either way on disk.
 */
function isSocketLive(path: string) {
  return new Promise<boolean>((resolve) => {
    const probe = connect(path);
    const settle = (live: boolean) => {
      probe.destroy();
      resolve(live);
    };

    probe.setTimeout(PROBE_TIMEOUT_MS, () => settle(false));
    probe.once("connect", () => settle(true));
    // ENOENT (clean boot) and ECONNREFUSED (stale file) both land here.
    probe.once("error", () => settle(false));
  });
}

async function removeStaleSocket(path: string) {
  if (await isSocketLive(path)) {
    throw new Error(
      `${path} is already served by a live process; refusing to replace it`,
    );
  }

  await unlink(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== "ENOENT") {
      throw error;
    }
  });
}

function listening(server: ServerType, options: ListenOptions) {
  return new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(options, () => {
      server.off("error", reject);
      resolve();
    });
  });
}

async function listenOnSocket(server: ServerType, path: string) {
  await removeStaleSocket(path);

  // The socket takes its mode from the umask at bind time. Binding under the
  // default 0o022 and widening afterwards would leave a window where anything
  // on the host could connect, so it is born 0o600 and relaxed to its final
  // mode once it exists.
  const previousUmask = process.umask(0o177);
  try {
    await listening(server, { path });
  } finally {
    process.umask(previousUmask);
  }

  await chmod(path, SOCKET_MODE);
}

/**
 * Node unlinks the socket file from inside server.close(), but only if close()
 * gets to run. Without this, the SIGTERM from `docker stop` would strand the
 * path for the next boot to trip over.
 */
function closeOnSignal(server: ServerType) {
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      server.close((error) => {
        if (error) {
          console.error(error);
        }
        process.exit(0);
      });
    });
  }
}

/**
 * Binds to a unix socket when API_SOCKET_PATH is set and a TCP port otherwise.
 * Production sets the socket path; development leaves it unset and gets a port
 * it can curl.
 */
export async function listen(server: ServerType) {
  closeOnSignal(server);

  const socketPath = process.env.API_SOCKET_PATH;
  if (socketPath) {
    await listenOnSocket(server, socketPath);
    console.log(`API listening on unix:${socketPath}`);
    return;
  }

  const port = Number(process.env.API_PORT ?? 5000);
  await listening(server, { port });
  console.log(`API listening on http://localhost:${port}`);
}
