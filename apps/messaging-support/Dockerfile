FROM base-deps AS messaging-support-base-deps

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM messaging-support-base-deps AS builder
WORKDIR /app

ENV NODE_ENV=production
ENV CI=true
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json pnpm-*.yaml ./
COPY patches/ patches/
COPY apps/messaging-support/package*.json apps/messaging-support/

RUN pnpm install --frozen-lockfile

COPY apps/messaging-support apps/messaging-support

WORKDIR /app/apps/messaging-support
RUN pnpm build

WORKDIR /app
RUN pnpm prune --prod


FROM 428528001781.dkr.ecr.eu-west-1.amazonaws.com/dhi.io/node:24-alpine3.23 AS runner

WORKDIR /app

USER node
ENV NODE_ENV=production
ENV PORT=1337

COPY --from=builder --chown=node:node /app/apps/messaging-support/.next/standalone ./
COPY --from=builder --chown=node:node /app/apps/messaging-support/.next/static ./apps/messaging-support/.next/static
COPY --from=builder --chown=node:node /app/apps/messaging-support/public ./apps/messaging-support/public

EXPOSE ${PORT}

CMD ["node", "apps/messaging-support/server.js"]
