# job-finder-web

Job Finder's frontend. Next.js App Router, Tailwind, React 19.

Fair warning on scope: the only thing the UI does today is sign you in and out.
The wiring below is real and finished; the product on top of it isn't started.

## Running it

From the repo root — `pnpm dev` brings this up with the API behind it. On its
own:

```sh
cp .env.example .env
pnpm dev
```

[localhost:3000](http://localhost:3000). The API needs to be running too, or
every `/api/*` request fails at the proxy.

## Talking to the API

The API is unreachable from the browser by design — in production it has no
network presence at all — so everything goes through the catch-all proxy at
[`app/api/[...path]/route.ts`](app/api/%5B...path%5D/route.ts). It forwards to
whichever transport is configured and passes the path through untouched.

It's a route handler rather than a `rewrites()` entry because Next serializes
`next.config` into the build output, which would bake the API's location into
the image instead of reading it at boot.

For actual calls, use the typed clients rather than raw `fetch`:

```ts
// client components
import { api } from "@repo/api-client/browser";

// server components, route handlers, server actions
import { apiClient } from "@repo/api-client/server";
const res = await apiClient(await headers()).api.something.$get();
```

The server client forwards nothing implicitly — a Server Component has no
ambient request to read — so pass the inbound headers when the call should
happen as the signed-in user, and omit them when it shouldn't.

For auth specifically, `@repo/auth/react` exports the usual
`signIn` / `signUp` / `signOut` / `useSession`. It's deliberately unconfigured:
its defaults point at the page's own origin and `/api/auth`, which is exactly
where the proxy is.

## Build notes

Three settings in [`next.config.ts`](next.config.ts) exist for the Docker image
and are easy to break by accident:

- `output: "standalone"` — the runner copies `.next/standalone` and little else.
- `compress: false` — Caddy owns compression. Next's gzip would get there first,
  and Caddy passes through anything that already has a `Content-Encoding`, which
  pins every client to gzip for no reason.
- `outputFileTracingRoot` — points at the repo root so tracing picks up the
  workspace packages hoisted there.

## Environment

| | |
| --- | --- |
| `API_URL` | where the API lives in development |
| `API_SOCKET_PATH` | production only, and takes precedence over `API_URL` |
| `JOB_FINDER_WEB_PORT` | dev/start port, defaults to 3000 |
