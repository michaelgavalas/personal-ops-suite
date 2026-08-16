# Personal Ops Suite

A monorepo for the small self-hosted tools I actually use. The idea is that every
tool gets its own frontend but shares one backend, one database, and one login —
so adding the third tool costs a lot less than adding the first.

There are no tools yet — what exists is the plumbing they'll share, and that
part is finished. Sign-in is already its own app rather than something a tool
owns, so the first tool doesn't have to build it and the second doesn't have to
reinvent it.

## How it fits together

```
                   ┌──────────────────────────────────────────────┐
   browser ──443──▶│ caddy          TLS, compression              │
                   └────┬─────────────────────────────┬───────────┘
        auth.<root>     │                             ┊  <tool>.<root>
                   ┌────▼─────────────────┐  ┌────────┴───────────┐
                   │ auth-web             │  ┊ a tool's frontend  ┊
                   │ sign in / sign up    │  ┊ gated by proxy.ts  ┊
                   └────┬─────────────────┘  └────────┬───────────┘
                        │   /api/* proxied straight through
                        └─────────────┬──────────────┘
                                      │ unix:/run/api/api.sock
                   ┌──────────────────▼───────────────────────────┐
                   │ api               Hono + Better Auth         │
                   └──────────────────┬───────────────────────────┘
                                      │ :5432 (compose network)
                   ┌──────────────────▼───────────────────────────┐
                   │ postgres          schema per tool            │
                   └──────────────────────────────────────────────┘
```

The dotted box is the shape a tool takes, not something that exists today.

Three things about this are worth calling out, because they explain most of the
code you'll read:

**The API has no network presence in production.** It listens on a unix socket
inside a volume shared with the frontend container. Nothing can dial it — not the
internet, not another container, not a stray process on the host. Every request
arrives through the Next.js proxy at `/api/*`, which forwards over the socket
with an undici dispatcher.

**The proxy doesn't rewrite the path.** `/api/auth/sign-in` hits the API as
`/api/auth/sign-in`, unchanged. That's deliberate: Better Auth builds its cookie
paths and OAuth callbacks from the public origin, so if the browser's path and
the server's path drifted apart, sign-in would break in ways that are miserable
to debug. Keeping them identical makes the whole thing boring instead.

**One session, several subdomains.** Signing in happens on `auth.<root>`; a
tool sits on its own subdomain of the same parent, and the session cookie is
scoped to that parent, so one sign-in covers all of them. This is why
production derives every host from a single `ROOT_DOMAIN` instead of taking
them one at a time — let two of them drift onto different parents and the
cookie silently stops being shared, which looks like a successful sign-in that
every tool ignores. Only the auth host exists today, so this is machinery
waiting for its first tenant rather than something currently load-bearing.

A signed-out visitor to a tool is bounced to the auth app with a `redirect_to`
naming where they were headed. That parameter comes from the URL, so the auth
app checks it against an allow-list of origins and falls back to the default
rather than following it — an open redirect on the domain people type their
password into is not a small bug.

In development none of this applies — the API binds a plain TCP port you can
curl, the same proxy talks to it over `http://localhost:5000`, and the cookie
is left host-only, since the apps differ only by port and cookies ignore ports.

## What's in here

| Package | What it does |
| --- | --- |
| [`apps/api`](apps/api) | The backend. Composition only — it mounts feature routers and picks a transport. |
| [`apps/auth-web`](apps/auth-web) | Sign in and sign up. The one door into every tool. |
| [`packages/api-core`](packages/api-core) | The `AppEnv` type and session middleware every feature router builds against. |
| [`packages/api-auth`](packages/api-auth) | The `/auth/*` routes, handed wholesale to Better Auth. |
| [`packages/api-client`](packages/api-client) | Typed RPC clients for the browser and the server, plus the proxy handler. |
| [`packages/auth`](packages/auth) | Better Auth configuration and the browser auth client. |
| [`packages/db`](packages/db) | Drizzle schema, migrations, and the client factory. |
| [`packages/ui`](packages/ui) | The shadcn component set, shared by every frontend. |
| [`packages/typescript-config`](packages/typescript-config) | Shared `tsconfig` bases. |

Backend features live in their own `api-*` package rather than in `apps/api`.
The app itself stays a list of `.route()` calls, which keeps feature code
portable if a second backend ever needs it.

Database tables live in a Postgres schema named after the tool. Only `auth`,
for shared identity, exists today; a tool gets its own schema alongside it.
Anything a second tool would need belongs in `auth` or a new shared schema,
never in a tool's own.

`packages/ui` holds the shadcn components verbatim, built on Base UI. They are
exported as TSX source rather than built, so apps consuming them need
`transpilePackages`. Biome skips `src/components` deliberately: reformatting
vendored files to match house style would make `shadcn diff` — the thing that
shows you what actually changed when a component is updated — report every file
as modified and become useless.

## Getting started

You'll need [Node 26.5.1](.node-version), pnpm 11.21.0, and Docker.

```sh
pnpm install
docker compose up -d          # postgres on :5432

cp apps/api/.env.example apps/api/.env
cp apps/auth-web/.env.example apps/auth-web/.env
cp packages/db/.env.example packages/db/.env

# generate a real secret for apps/api/.env
openssl rand -base64 32

pnpm --filter @repo/db db:migrate
pnpm dev
```

That gives you the auth app on [localhost:3001](http://localhost:3001) and the
API on [localhost:5000](http://localhost:5000).

`localhost:3001` is where a fresh setup starts — create an account there. With
no tool to hand off to yet, signing in lands you back on the auth app's own
page; a tool added later becomes the `DEFAULT_REDIRECT_URL`.

### Environment

Each `.env` sits next to the thing that reads it. There's no root `.env` for
development — the one at the root is for production only.

| File | Who reads it | What's in it |
| --- | --- | --- |
| `apps/api/.env` | the API | `DATABASE_URL`, `API_PORT`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `BETTER_AUTH_TRUSTED_ORIGINS` |
| `apps/auth-web/.env` | Next.js | `API_URL`, `DEFAULT_REDIRECT_URL`, `ALLOWED_REDIRECT_ORIGINS` |
| `packages/db/.env` | drizzle-kit | `DATABASE_URL` |
| `.env` | `docker-compose.prod.yml` | `ROOT_DOMAIN`, ACME email, Postgres password, auth secret |

`BETTER_AUTH_URL` is the origin the *browser* uses, with no path on the end. Not
the socket, not `localhost:5000` — a path there stops Better Auth matching any
route at all, which is a fun afternoon. It points at the auth app, since that's
where signing in happens.

`BETTER_AUTH_TRUSTED_ORIGINS` has to list every tool as well, because each one
proxies `/api/auth` on its own origin to read the session and sign out. Miss one
and those calls come back `403 INVALID_ORIGIN` while sign-in itself looks fine.
Today the auth app is the only entry.

A tool's frontend configures its own public origin rather than reading it off
the request: behind Caddy the request carries the internal container address,
so a redirect built from it would send people somewhere unreachable.

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
Docker images when anything that affects packaging changes. `main`
requires a green run to merge into.

`check-types` runs `next typegen` before `tsc` in the Next apps. `PageProps`
and `LayoutProps` are generated into `.next/types`, so without it a cold cache
fails on types that simply aren't there yet.

## Deploying

The target is a single VPS running Docker. Caddy handles TLS and is the only
container that publishes ports.

```sh
cp .env.example .env          # then fill it in for real
docker compose -f docker-compose.prod.yml up -d --build
```

Point `auth.<root>` at the box first — Caddy tries to get a certificate on
startup, and Let's Encrypt has rate limits worth respecting. Adding a tool
means adding its subdomain to DNS and a block to the Caddyfile before the
next deploy, for the same reason.

`.env` carries `ROOT_DOMAIN` and nothing more domain-shaped. Compose derives
every host and origin from it, which is deliberate: the shared session cookie
only works while all of them sit under one parent, and deriving them makes that
impossible to get wrong by hand.

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
client, the shared component library, the production stack, migrations, CI.

Not started: any actual tool. This is a foundation with nothing built on it
yet — the cross-subdomain session, the per-tool schema convention, and the
`api-*` feature-router split are all in place and all currently serving a
single app. The first tool is where they get tested for real.

Known gaps: CI only rebuilds the Docker images when a packaging path changes,
so an image can break from a source change and go unnoticed until the next one
— a nightly build would close it. Password reset and email verification don't
exist. Nothing rate-limits sign-in beyond what Better Auth does by default.

## License

[Apache 2.0](LICENSE).
