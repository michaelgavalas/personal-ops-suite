# Personal Ops Suite

A monorepo for the small self-hosted tools I actually use. The idea is that every
tool gets its own frontend but shares one backend, one database, and one login —
so adding the third tool costs a lot less than adding the first.

Right now there is one tool, **Job Finder**, and it is still mostly scaffolding.
The plumbing underneath it is the part that's finished.

## How it fits together

```
                   ┌──────────────────────────────────────────────┐
   browser ──443──▶│ caddy          TLS, compression              │
                   └──────┬───────────────────────────────────────┘
                          │ :3000 (compose network)
                   ┌──────▼───────────────────────────────────────┐
                   │ job-finder-web    Next.js                    │
                   │   /api/*  ─────┐  proxied straight through   │
                   └────────────────┼─────────────────────────────┘
                                    │ unix:/run/api/api.sock
                   ┌────────────────▼─────────────────────────────┐
                   │ api               Hono + Better Auth         │
                   └────────────────┬─────────────────────────────┘
                                    │ :5432 (compose network)
                   ┌────────────────▼─────────────────────────────┐
                   │ postgres          schema per tool            │
                   └──────────────────────────────────────────────┘
```

Two things about this are worth calling out, because they explain most of the
code you'll read:

**The API has no network presence in production.** It listens on a unix socket
inside a volume shared with the web container. Nothing can dial it — not the
internet, not another container, not a stray process on the host. Every request
arrives through the Next.js proxy at `/api/*`, which forwards over the socket
with an undici dispatcher.

**The proxy doesn't rewrite the path.** `/api/auth/sign-in` hits the API as
`/api/auth/sign-in`, unchanged. That's deliberate: Better Auth builds its cookie
paths and OAuth callbacks from the public origin, so if the browser's path and
the server's path drifted apart, sign-in would break in ways that are miserable
to debug. Keeping them identical makes the whole thing boring instead.

In development none of this applies — the API binds a plain TCP port you can
curl, and the same proxy talks to it over `http://localhost:5000`.

## What's in here

| Package | What it does |
| --- | --- |
| [`apps/api`](apps/api) | The backend. Composition only — it mounts feature routers and picks a transport. |
| [`apps/job-finder-web`](apps/job-finder-web) | Job Finder's frontend. Next.js, Tailwind, standalone output. |
| [`packages/api-core`](packages/api-core) | The `AppEnv` type and session middleware every feature router builds against. |
| [`packages/api-auth`](packages/api-auth) | The `/auth/*` routes, handed wholesale to Better Auth. |
| [`packages/api-client`](packages/api-client) | Typed RPC clients for the browser and the server, plus the proxy handler. |
| [`packages/auth`](packages/auth) | Better Auth configuration and the browser auth client. |
| [`packages/db`](packages/db) | Drizzle schema, migrations, and the client factory. |
| [`packages/typescript-config`](packages/typescript-config) | Shared `tsconfig` bases. |

Backend features live in their own `api-*` package rather than in `apps/api`.
The app itself stays a list of `.route()` calls, which keeps feature code
portable if a second backend ever needs it.

Database tables live in a Postgres schema named after the tool — `auth` for
shared identity, `job_finder` for Job Finder. Anything a second tool would need
belongs in `auth` or a new shared schema, never in a tool's own.

## Getting started

You'll need [Node 26.5.1](.node-version), pnpm 11.21.0, and Docker.

```sh
pnpm install
docker compose up -d          # postgres on :5432

cp apps/api/.env.example apps/api/.env
cp apps/job-finder-web/.env.example apps/job-finder-web/.env
cp packages/db/.env.example packages/db/.env

# generate a real secret for apps/api/.env
openssl rand -base64 32

pnpm --filter @repo/db db:migrate
pnpm dev
```

That gives you the web app on [localhost:3000](http://localhost:3000) and the
API on [localhost:5000](http://localhost:5000).

### Environment

Each `.env` sits next to the thing that reads it. There's no root `.env` for
development — the one at the root is for production only.

| File | Who reads it | What's in it |
| --- | --- | --- |
| `apps/api/.env` | the API | `DATABASE_URL`, `API_PORT`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` |
| `apps/job-finder-web/.env` | Next.js | `API_URL` |
| `packages/db/.env` | drizzle-kit | `DATABASE_URL` |
| `.env` | `docker-compose.prod.yml` | domain, ACME email, Postgres password, auth secret |

`BETTER_AUTH_URL` is the origin the *browser* uses, with no path on the end. Not
the socket, not `localhost:5000` — a path there stops Better Auth matching any
route at all, which is a fun afternoon.

## Day to day

| Command | |
| --- | --- |
| `pnpm dev` | everything, in watch mode |
| `pnpm build` | build all apps and packages |
| `pnpm test` | Vitest, across the workspace |
| `pnpm lint` | Biome, across the workspace |
| `pnpm check-types` | `tsc --noEmit`, across the workspace |
| `pnpm format` | Biome, writing fixes |
| `pnpm --filter @repo/db db:generate` | write a migration from schema changes |
| `pnpm --filter @repo/db db:migrate` | apply pending migrations |

Turbo caches all of it, so a second run of anything unchanged is instant.

After editing a schema in `packages/db/src`, run `db:generate` and commit the
generated SQL alongside it. Both belong in the same commit — a schema change
without its migration is a broken deploy waiting to happen.

CI runs lint, types, build, and tests on every pull request, and builds both
Docker images when anything that affects packaging changes. `main` requires a
green run to merge into.

## Deploying

The target is a single VPS running Docker. Caddy handles TLS and is the only
container that publishes ports.

```sh
cp .env.example .env          # then fill it in for real
docker compose -f docker-compose.prod.yml up -d --build
```

Point your domain's A record at the box first — Caddy will try to get a
certificate on startup, and Let's Encrypt has rate limits worth respecting.

`docker-compose.prod.yml` is standalone, not an override of the dev compose
file. The dev one publishes 5432 to the host, and that must never reach
production.

Migrations run themselves. A one-shot `migrate` service applies anything
pending and exits, and the API waits for it to succeed before starting — so a
bad migration keeps the old container serving rather than bringing up a new one
against a schema it doesn't match. It's a separate service rather than part of
the API's startup so that only one process ever touches the schema, however
many API containers there end up being.

## State of things

Working: auth (email/password) end to end, the socket transport, the typed RPC
client, the production stack, migrations, CI.

Not started: everything Job Finder actually does. `job_finder.saved_jobs` exists
in the database and nothing reads it yet, and the frontend is a sign-in box and
not much else.

## License

[Apache 2.0](LICENSE).
