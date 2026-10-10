# ==========================================
# AiHub Frontend Multi-stage Dockerfile
# ==========================================

ARG NODE_IMAGE=node:20-slim

FROM ${NODE_IMAGE} AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts --libc=glibc

COPY . .

# Next.js build args
ARG NEXT_PUBLIC_API_URL=https://api.aihubproduction.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_BUILD_ID
ARG SOURCE_DATE_EPOCH

RUN --mount=type=secret,id=next_server_actions_key,required=false \
    --mount=type=secret,id=next_preview_info,required=false \
    --mount=type=secret,id=next_rsc_info,required=false \
    if [ -f /run/secrets/next_preview_info ]; then \
      mkdir -p .next/cache && cp /run/secrets/next_preview_info .next/cache/.previewinfo; \
    fi && \
    if [ -f /run/secrets/next_rsc_info ]; then \
      mkdir -p .next/cache && cp /run/secrets/next_rsc_info .next/cache/.rscinfo; \
    fi && \
    if [ -f /run/secrets/next_server_actions_key ]; then \
      NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$(cat /run/secrets/next_server_actions_key)" npm run build; \
    else \
      npm run build; \
    fi
# Parity builds omit Next's transient compiler and packaging traces.
RUN npm prune --omit=dev --libc=glibc && \
    if [ -n "$SOURCE_DATE_EPOCH" ]; then \
      rm -rf /app/.next/cache/turbopack /app/.next/cache/.tsbuildinfo /app/.next/trace /app/.next/trace-build /app/.next/next-server.js.nft.json && \
      mkdir -p /app/.next/cache; \
    fi

FROM ${NODE_IMAGE} AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV NEXT_TELEMETRY_DISABLED=1

COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/data/mirror ./data/mirror

USER node

EXPOSE 3000

CMD ["npm", "start"]
