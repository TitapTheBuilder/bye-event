ARG BASE_IMAGE=docker.arvancloud.ir/node:22-alpine
FROM ${BASE_IMAGE} AS base
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@11.18.0 --activate

FROM base AS pruner
WORKDIR /app
COPY . .
RUN pnpm dlx turbo@2.10.8 prune @repo/db --docker

FROM base AS runner
WORKDIR /app
COPY --from=pruner --chown=node:node /app/out/json/ .
COPY --from=pruner --chown=node:node /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --fetch-timeout 600000
COPY --from=pruner --chown=node:node /app/out/full/ .
USER node
ENV NODE_ENV=production
CMD ["pnpm", "--filter", "@repo/db", "migrate"]
