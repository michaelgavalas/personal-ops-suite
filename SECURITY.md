# Security

This is a personal project run on a single VPS. There is no security team and
no SLA — but if you've found something, I'd genuinely like to know.

## Reporting

Open a [private security advisory](https://github.com/michaelgavalas/personal-ops-suite/security/advisories/new).
That keeps the details out of public issues until there's a fix. Please don't
open a regular issue for anything exploitable.

I'll acknowledge within a week or so. Since only I run this, "supported
versions" means `main` — there are no backports.

## What's already assumed

Some things are known properties of the design rather than findings:

- **The API trusts `x-forwarded-for`.** It has to, because a unix socket has no
  peer address and rate limiting would otherwise treat every caller as the same
  client. This is safe only because Caddy is the sole ingress and overwrites the
  header. Exposing the API by any other route breaks that assumption.
- **The API has no authentication of its own at the transport layer.** Anything
  able to open the unix socket can talk to it as an unauthenticated client. The
  socket is mode `0660` inside a volume shared only with the web container.
- **`BETTER_AUTH_SECRET` is the whole ballgame.** It signs sessions. Rotating it
  logs everyone out; leaking it is a full compromise.

Reports that these exist aren't findings. Reports that one of them doesn't hold
— that the header can be spoofed past Caddy, that the socket is reachable from
somewhere it shouldn't be — very much are.
