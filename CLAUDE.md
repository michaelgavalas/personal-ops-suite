# CLAUDE.md

How this codebase thinks, followed by behavioral guidelines that reduce common LLM coding mistakes.

Read "The Product" and "The Architecture" before your first edit in a session. They are not background colour — most of the code only makes sense once you know which constraint it exists to satisfy, and a change that violates one of them will look perfectly reasonable in isolation.

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

---

## The Product

A monorepo of small self-hosted tools for **one person on one VPS**. That framing decides more than it looks like it does:

- **There is no scale requirement.** No multi-region, no horizontal scaling, no read replicas, no caching layer. Proposing any of them is a misread of the problem. Postgres on the same box is the answer until it demonstrably isn't.
- **The shared foundation is the asset. Individual tools are disposable.** Tools get built, and tools get deleted — one was removed wholesale, and the foundation underneath it did not move. Never let a tool's requirements bleed into shared code, and never make a tool hard to remove.
- **The third tool should cost less than the first.** This is the entire point of the repo. When you build a tool and hit something the *next* tool would also need, that thing belongs in shared code — `packages/api-core`, `packages/ui`, the `auth` schema — not in the tool.
- **One login covers everything.** Auth is its own app and its own package, extracted before a second consumer existed, precisely so no tool ever reinvents it.
- **Boring and self-hosted beats clever and managed.** Every dependency is something that runs on the box. Prefer fewer.

## The Architecture

These are invariants, not preferences. Each one has a failure mode attached — that is why it exists. If a task seems to require breaking one, stop and say so rather than working around it.

**The API has no network presence in production.** It listens on a unix socket in a volume shared with the frontend container. Nothing can dial it — not the internet, not another container, not a stray process on the host. Never add a published port, a compose `ports:` entry, or an "internal only" HTTP listener to `apps/api`. Only `caddy` publishes ports.

**The proxy never rewrites paths.** `/api/auth/sign-in` reaches the API as `/api/auth/sign-in`. Better Auth builds cookie paths and OAuth callbacks from the public origin, so the moment the browser's path and the server's path diverge, sign-in breaks in ways that are miserable to debug.

**Every public host derives from one `ROOT_DOMAIN`.** The session cookie is scoped to the registrable parent, so a single sign-in covers every subdomain — and that only holds while all of them sit under the same parent. Hosts are derived rather than listed so they cannot drift apart by hand. Never hardcode a host, and never let two of them come from separate variables.

**Redirect targets are allow-listed, always.** `?redirect_to=` comes from the URL. It is checked against a list of origins and falls back to the default rather than being followed. Never widen this to a wildcard, a suffix match, or "any subdomain of" — an open redirect on the page where people type their password is not a small bug.

**`apps/*` are composition only; features live in `packages/*`.** `apps/api/src/app.ts` is a list of `.route()` calls and nothing else. A feature's routes go in its own `packages/api-<feature>` built against `AppEnv` from `packages/api-core`, so every router shares one context type and the RPC client's inference survives.

**One Postgres schema per tool.** `auth` holds shared identity. A tool gets its own schema named after it. Anything a second tool would plausibly need belongs in `auth` or a new shared schema — never inside one tool's.

**Schema changes and their migration land in the same commit.** Run `db:generate`, read the generated SQL before trusting it, and commit both. A schema change without its migration is a broken deploy waiting to happen. In production exactly one process touches the schema: the one-shot `migrate` service, which the API waits on.

**Vendored code stays byte-identical.** `packages/ui/src/components` and `src/hooks` are shadcn output, and `packages/ui/biome.json` excludes both on purpose. Reformatting them to house style makes `shadcn diff` — the only thing that shows what actually changed on update — report every file as modified and become useless.

**Comments explain the failure mode, not the mechanism.** This is the most distinctive property of the codebase and the main reason it is navigable. The code already says *what* it does; a comment earns its place by saying what breaks if you do the obvious thing instead. Match this. A comment that restates the line below it is worse than no comment.

**Development differs from production deliberately, and every difference is documented.** Dev binds a TCP port you can curl; the cookie is left host-only because the apps differ only by port. If you introduce a new dev/prod divergence, say why in a comment, or you have introduced a bug that only appears on the VPS.

## 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:

- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

## 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

## 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:

- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:

- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

## 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:

- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:

```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

## 5. Verify Versions. Assume You Are Out Of Date

**Your training data is older than this repo. Treat every version fact as unverified until you have checked it.**

This is not hypothetical caution. This repo runs releases that postdate most models' knowledge, and several carry breaking changes from the version you probably learned:

| | version | as of 2026-08-16 |
| --- | --- | --- |
| Node | 26.5.1 | pinned in `.node-version` and the Dockerfiles |
| pnpm | 11.21.0 | pinned in `packageManager` |
| TypeScript | 7.0.2 | a major rewrite; `.vscode` enables `useTsgo` |
| Next.js | 16.3.0 | **assume your Next knowledge is wrong** |
| React | 19.2.8 | |
| Hono | 4.13.1 | |
| Drizzle | orm 0.45.2 / kit 0.31.10 | |
| Better Auth | 1.6.26 | |
| Biome | 2.5.7 | |
| Turbo | 2.10.9 | |
| Vitest | 4.1.10 | |

That table is a snapshot and will itself go stale. Regenerate rather than trust it — pnpm's layout means a package resolves from whichever workspace depends on it, not the root:

```sh
node -p "require('./apps/auth-web/node_modules/next/package.json').version"
```

Before writing code against any of these:

- **Read the installed package, not your memory.** The `.d.ts` files in `node_modules` are the authority on what the API actually is. A function that existed in the version you know may be renamed, deprecated, or gone.
- **Next.js ships its own agent documentation** at `node_modules/next/dist/docs/` (resolve it from the app, not the repo root). Read the relevant guide before writing Next code. Heed deprecation notices. `next dev` also writes an `AGENTS.md` into each Next app restating this — if you see one, it is authoritative and belongs in your commit rather than being reverted.
- **Search the web for release notes and breaking changes** when the installed version is ahead of what you know, and cite what you find. Recalling an API from training is not checking.
- **Never bump a pinned version as a side effect** of another task. Node, pnpm and `@types/node` are pinned together across `.node-version`, `package.json` and the Dockerfiles; they move by hand, together, deliberately.

## 6. Disagree With Evidence, Not With Confidence

**"Trust me" does not work in either direction — not from you, and not accepted from anyone else.**

When you think a request is wrong, say so. But an assertion is not an argument. Bring one of:

- **A file and line.** `apps/api/src/app.ts:12` — quote what is actually there.
- **Command output.** Run the thing. Paste what it printed. A failing test, a `psql` result, a type error.
- **A demonstration.** Write the smallest probe that shows the behaviour, run it, show the result, delete it. This beats every kind of reasoning about what the code "would" do, and it has caught real bugs that looked fine on inspection.
- **The installed source or types**, quoted, with the path you read it from.
- **Documentation you actually fetched**, with the URL — not documentation you remember.

Inadmissible: "this is a best practice", "that's an anti-pattern", "I believe X changed in v5", "this could cause issues". If you cannot name the failure, you do not yet have an objection — you have a feeling. Go get evidence or drop it.

Two failure modes to avoid in equal measure:

- **Caving.** If you have evidence and get pushback without counter-evidence, do not fold. Restate the evidence once, plainly. Agreement that isn't earned is worse than useless because it reads as confirmation.
- **Grinding.** If the user reaffirms after seeing the evidence, that is their call to make. Say you disagree in one sentence, note what you expect to break, then implement the full request properly — not a hedged half-version.

Report outcomes the same way. If tests fail, show the output. If you skipped something, say which part and why. Never describe work as verified when what you did was assume.

## 7. Onwards

This document grows as we notice things. When you add a rule here, write it the way the codebase writes comments: state the failure mode it prevents, and cite the incident that prompted it. A rule nobody can trace back to a real problem gets ignored, and rightly so.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, clarifying questions come before implementation rather than after mistakes, version claims come with a path or a URL, and disagreements get settled by running something rather than by whoever sounds more certain.
