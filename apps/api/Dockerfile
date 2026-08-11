# syntax=docker/dockerfile:1
# Build from the repo root: docker build -f apps/api/Dockerfile .

FROM node:26-alpine AS base
# CI=true lets pnpm purge node_modules non-interactively during the --prod pass.
ENV CI=true
RUN npm install -g pnpm@11.21.0
WORKDIR /repo

# Narrow the workspace to api and its deps, so changes to unrelated
# apps don't invalidate the install layer below.
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.10.9 prune api --docker

FROM base AS builder
COPY --from=pruner /repo/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /repo/out/full/ .
RUN pnpm turbo run build --filter=api
# Drop devDependencies. The removal is required: pnpm no-ops `--prod` against an
# existing node_modules, silently leaving the full toolchain in the image.
RUN rm -rf node_modules apps/*/node_modules packages/*/node_modules \
	&& pnpm install --frozen-lockfile --prod

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder --chown=node:node /repo .
USER node
CMD ["node", "apps/api/dist/index.js"]
