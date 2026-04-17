FROM base-deps AS messaging-api-base-deps

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM messaging-api-base-deps AS builder
WORKDIR /app

COPY ./pnpm*.yaml /app/
COPY ./package.json /app/
COPY ./patches/ /app/patches/
COPY ./apps/messaging-api/ /app/apps/messaging-api/
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store pnpm install --frozen-lockfile
RUN pnpm build:api
RUN pnpm deploy --filter=messaging-api --prod /app/deploy

FROM 428528001781.dkr.ecr.eu-west-1.amazonaws.com/dhi.io/node:24-alpine3.23 AS runner

WORKDIR /app

USER node

ENV NODE_ENV=production
ENV LOG_LEVEL=info
ENV PORT=8002

COPY --from=builder --chown=node:node /app/deploy/dist /app/apps/messaging-api/dist
COPY --from=builder --chown=node:node /app/deploy/node_modules /app/apps/messaging-api/node_modules
COPY --from=builder --chown=node:node /app/deploy/package.json /app/apps/messaging-api/
COPY --from=builder --chown=node:node /app/deploy/pnpm*.yaml /app/apps/messaging-api/

EXPOSE ${PORT}

WORKDIR /app/apps/messaging-api

CMD [ "node", "--import", "./dist/instrumentation.js", "dist/index.js" ]