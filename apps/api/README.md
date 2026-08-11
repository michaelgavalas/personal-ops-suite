# api

The backend for every tool in the suite. Hono, Better Auth, Postgres.

This app is composition and nothing else. [`app.ts`](src/app.ts) mounts feature
routers under `/api` and exports the router type for the RPC client; the
features themselves live in `packages/api-*`. If you're adding an endpoint, it
almost certainly belongs in one of those, or in a new one.

## Running it

From the repo root — `pnpm dev` starts this alongside the web app. On its own:

```sh
cp .env.example .env
pnpm dev
```

It comes up on [localhost:5000](http://localhost:5000). Every route sits under
`/api`, so the auth endpoints are at `/api/auth/*` and nothing answers at the
root.

```sh
curl -i localhost:5000/api/auth/session
```

## Two transports

[`listen.ts`](src/listen.ts) picks how to bind based on the environment:

- `API_SOCKET_PATH` set → unix socket. This is production. The socket is created
  under a tight umask and chmod'd to `0660`, stale files from a killed process
  are detected by trying to connect to them, and SIGTERM closes the server so
  Node unlinks the path on the way out.
- otherwise → TCP on `API_PORT` (default 5000). This is development, where
  being able to curl the thing is worth more than the isolation.

Nothing else in the codebase branches on which one is in use. The client side
makes the same choice independently in
[`@repo/api-client/server`](../../packages/api-client/src/server.ts).

## Adding a feature router

1. Create `packages/api-<feature>` with a `Hono<AppEnv>` router as its export.
   The `AppEnv` from `@repo/api-core` is not optional — routers that don't share
   it don't compose, and the RPC client's type inference quietly collapses.
2. `.route()` it into `app.ts`.
3. Mind the order. `sessionMiddleware` runs after the auth routes on purpose:
   signing in creates a session rather than reading one, so resolving it first
   would spend a database round trip per sign-in on a result nobody looks at.
   Anything that needs `c.get("session")` goes after the middleware.

## Tests

`pnpm test`. The suite covers `listen.ts` — stale sockets, refusing to displace
a live one, permission bits — because that logic is easy to get subtly wrong and
its failure mode is a container that won't boot.

## Environment

| | |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `BETTER_AUTH_SECRET` | signing key — `openssl rand -base64 32`. Changing it logs everyone out. |
| `BETTER_AUTH_URL` | the public origin the browser uses. Origin only, no path. |
| `API_PORT` | dev only, defaults to 5000 |
| `API_SOCKET_PATH` | production only, and takes precedence over `API_PORT` |
