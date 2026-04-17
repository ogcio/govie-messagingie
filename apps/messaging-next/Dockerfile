FROM base-deps AS messaging-next-base-deps

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable

FROM messaging-next-base-deps AS builder
WORKDIR /app

# Copy dependency files for better layer caching
COPY package.json pnpm-*.yaml /app/
COPY patches/ /app/patches/
COPY apps/messaging-next/package*.json /app/apps/messaging-next/

RUN apk update && \
    apk upgrade && \
    apk add envsubst

# Install dependencies with cache mount for faster builds
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

# Copy source code
COPY ./apps/messaging-next/ /app/apps/messaging-next/

# Build arguments for build-time configuration
ENV NODE_ENV=production
ENV CI=true

ARG NEXT_PUBLIC_MESSAGING_NEXT_BASE_URL
ARG NEXT_PUBLIC_SAG_URL
ARG NEXT_PUBLIC_PROFILE_SERVICE_ENTRY_POINT
ARG NEXT_PUBLIC_MESSAGING_ADMIN_SERVICE_ENTRY_POINT
ARG NEXT_PUBLIC_DASHBOARD_SERVICE_ENTRY_POINT
ARG NEXT_PUBLIC_FARO_URL
ARG NEXT_PUBLIC_FARO_SERVICE_NAME
ARG NEXT_PUBLIC_FARO_SERVICE_NAMESPACE
ARG NEXT_PUBLIC_FARO_PROPAGATE_TRACE_HEADER
ARG NEXT_PUBLIC_UNLEASH_URL
ARG NEXT_PUBLIC_UNLEASH_CLIENT_KEY
ARG NEXT_PUBLIC_UNLEASH_APP_NAME

# Matomo (same pattern as main pipeline: protocol + protocol-relative host)
ARG NEXT_PUBLIC_MATOMO_URL=//analytics.ogcio.gov.ie
ARG NEXT_PUBLIC_MATOMO_PROTOCOL=https
ARG NEXT_PUBLIC_ANALYTICS_WEBSITE_ID
ARG NEXT_PUBLIC_ANALYTICS_ORGANIZATION_ID=ogcio
ARG NEXT_PUBLIC_ANALYTICS_DRY_RUN="false"

ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_MESSAGING_NEXT_BASE_URL}
ENV NEXT_PUBLIC_SAG_URL=${NEXT_PUBLIC_SAG_URL}
ENV NEXT_PUBLIC_PROFILE_URL=${NEXT_PUBLIC_PROFILE_SERVICE_ENTRY_POINT}
ENV NEXT_PUBLIC_MESSAGING_ADMIN_URL=${NEXT_PUBLIC_MESSAGING_ADMIN_SERVICE_ENTRY_POINT}
ENV NEXT_PUBLIC_DASHBOARD_URL=${NEXT_PUBLIC_DASHBOARD_SERVICE_ENTRY_POINT}
ENV NEXT_PUBLIC_FARO_URL=${NEXT_PUBLIC_FARO_URL}
ENV NEXT_PUBLIC_FARO_SERVICE_NAME=${NEXT_PUBLIC_FARO_SERVICE_NAME}
ENV NEXT_PUBLIC_FARO_SERVICE_NAMESPACE=${NEXT_PUBLIC_FARO_SERVICE_NAMESPACE}
ENV NEXT_PUBLIC_FARO_PROPAGATE_TRACE_HEADER=${NEXT_PUBLIC_FARO_PROPAGATE_TRACE_HEADER}
ENV NEXT_PUBLIC_UNLEASH_URL=${NEXT_PUBLIC_UNLEASH_URL}
ENV NEXT_PUBLIC_UNLEASH_CLIENT_KEY=${NEXT_PUBLIC_UNLEASH_CLIENT_KEY}
ENV NEXT_PUBLIC_UNLEASH_APP_NAME=${NEXT_PUBLIC_UNLEASH_APP_NAME:-messaging}

ENV NEXT_PUBLIC_MATOMO_URL=${NEXT_PUBLIC_MATOMO_URL}
ENV NEXT_PUBLIC_MATOMO_PROTOCOL=${NEXT_PUBLIC_MATOMO_PROTOCOL}
# Browser calls must be same-origin: nginx proxies /_next/analytics-api/ → analytics API (avoids CORS; path under /_next/ so CloudFront forwards it)
ENV NEXT_PUBLIC_ANALYTICS_URL=${NEXT_PUBLIC_MESSAGING_NEXT_BASE_URL}/_next/analytics-api
ENV NEXT_PUBLIC_ANALYTICS_WEBSITE_ID=${NEXT_PUBLIC_ANALYTICS_WEBSITE_ID}
ENV NEXT_PUBLIC_ANALYTICS_ORGANIZATION_ID=${NEXT_PUBLIC_ANALYTICS_ORGANIZATION_ID}
ENV NEXT_PUBLIC_ANALYTICS_DRY_RUN=${NEXT_PUBLIC_ANALYTICS_DRY_RUN:-false}

ARG PORT
ARG OTEL_ENABLE
ARG OTEL_SERVICE_NAME
ARG OTEL_COLLECTOR_URL

ENV PORT=${PORT:-3002}
ENV OTEL_ENABLE=${OTEL_ENABLE:-true}
ENV OTEL_SERVICE_NAME=${OTEL_SERVICE_NAME:-messaging-next}
ENV OTEL_COLLECTOR_URL=${OTEL_COLLECTOR_URL}

ARG TRUSTED_PROXY_CIDR
ENV TRUSTED_PROXY_CIDR=${TRUSTED_PROXY_CIDR:-0.0.0.0/0}

# Nginx proxy target for GET /api/v1/websites/{id} (differs per env — see pipeline-variables/*.yml)
ARG ANALYTICS_MANAGEMENT_API_ORIGIN=https://api.analytics.dev.services.gov.ie
ARG ANALYTICS_MANAGEMENT_API_HOST=api.analytics.dev.services.gov.ie
ENV ANALYTICS_MANAGEMENT_API_ORIGIN=${ANALYTICS_MANAGEMENT_API_ORIGIN}
ENV ANALYTICS_MANAGEMENT_API_HOST=${ANALYTICS_MANAGEMENT_API_HOST}

# Matomo tracker script/beacon host (from analytics API trackerUrl — env-specific)
ARG ANALYTICS_TRACKER_ORIGIN=https://track.analytics.dev.services.gov.ie
ENV ANALYTICS_TRACKER_ORIGIN=${ANALYTICS_TRACKER_ORIGIN}

ENV CSP_CONNECT_SRC="${NEXT_PUBLIC_SAG_URL} ${NEXT_PUBLIC_FARO_URL} ${NEXT_PUBLIC_UNLEASH_URL} ${NEXT_PUBLIC_ANALYTICS_URL}"

# Build the application
# Note: build:prod script handles tsconfig.prod.json merging and runs next build
RUN pnpm --filter=messaging-next build:prod

# Prune dev dependencies for production
RUN pnpm prune --prod

# Pre-compress static assets at max level for gzip_static serving
RUN find /app/apps/messaging-next/out -type f \( -name '*.html' -o -name '*.css' -o -name '*.js' -o -name '*.json' -o -name '*.svg' -o -name '*.xml' -o -name '*.txt' \) -exec gzip -k -9 {} +

RUN envsubst '${OTEL_ENABLE} ${OTEL_SERVICE_NAME} ${OTEL_COLLECTOR_URL} ${PORT} ${TRUSTED_PROXY_CIDR} ${CSP_CONNECT_SRC} ${ANALYTICS_MANAGEMENT_API_ORIGIN} ${ANALYTICS_MANAGEMENT_API_HOST} ${ANALYTICS_TRACKER_ORIGIN}' <"/app/apps/messaging-next/docker/nginx.conf.template" > "/app/apps/messaging-next/docker/nginx.conf"

# Production stage — nginx serves the static export
FROM nginxinc/nginx-unprivileged:1.29-alpine-otel AS runner

USER root

# Remove default site
RUN rm /etc/nginx/conf.d/default.conf

# Copy static export from builder
COPY --from=builder /app/apps/messaging-next/out/ /usr/share/nginx/html/
COPY --from=builder /app/apps/messaging-next/docker/nginx.conf /etc/nginx/nginx.conf

ARG PORT
ENV PORT=${PORT:-3002}
EXPOSE ${PORT}

USER nginx

CMD ["nginx", "-g", "daemon off;"]
