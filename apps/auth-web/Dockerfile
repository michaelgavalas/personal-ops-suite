# syntax=docker/dockerfile:1
# Build from the repo root: docker build -f apps/auth-web/Dockerfile .

FROM node:26-alpine AS base
RUN npm install -g pnpm@11.21.0
WORKDIR /repo

FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.10.9 prune auth-web --docker

FROM base AS builder
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm turbo run build --filter=auth-web

# The standalone bundle carries its own node_modules, so the runner starts from
# a clean base rather than inheriting the build toolchain.
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /repo/apps/auth-web
COPY --from=builder --chown=node:node /repo/apps/auth-web/.next/standalone /repo/
COPY --from=builder --chown=node:node /repo/apps/auth-web/.next/static ./.next/static
COPY --from=builder --chown=node:node /repo/apps/auth-web/public ./public
# Matches the api image so the shared socket volume gets the same ownership
# whichever container Docker happens to create it from.
RUN mkdir -p /run/api && chown node:node /run/api
USER node
# server.js reads PORT/HOSTNAME; 0.0.0.0 so Caddy can reach it across the network.
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
CMD ["node", "server.js"]
