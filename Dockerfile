# AiHub Frontend Runtime Image

ARG NODE_IMAGE=node:20-slim

FROM ${NODE_IMAGE}

WORKDIR /app

ARG NEXT_PUBLIC_API_URL=https://api.aihubproduction.com
ARG NEXT_BUILD_ID
ARG SOURCE_DATE_EPOCH
ENV NEXT_TELEMETRY_DISABLED=1

RUN --mount=type=bind,target=/source \
    --mount=type=secret,id=next_server_actions_key,required=false \
    --mount=type=secret,id=next_preview_info,required=false \
    --mount=type=secret,id=next_rsc_info,required=false \
    set -eu; \
    cp -a /source/. /app/; \
    npm ci --ignore-scripts --libc=glibc; \
    if [ -f /run/secrets/next_preview_info ]; then \
      mkdir -p .next/cache && cp /run/secrets/next_preview_info .next/cache/.previewinfo; \
    fi; \
    if [ -f /run/secrets/next_rsc_info ]; then \
      mkdir -p .next/cache && cp /run/secrets/next_rsc_info .next/cache/.rscinfo; \
    fi; \
    if [ -f /run/secrets/next_server_actions_key ]; then \
      NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$(cat /run/secrets/next_server_actions_key)" npm run build; \
    else \
      npm run build; \
    fi; \
    npm prune --omit=dev --libc=glibc; \
    if [ -n "$SOURCE_DATE_EPOCH" ]; then \
      rm -rf /app/.next/cache/turbopack /app/.next/cache/.tsbuildinfo /app/.next/trace /app/.next/trace-build /app/.next/next-server.js.nft.json; \
      mkdir -p /app/.next/cache; \
    fi; \
    npm cache clean --force; \
    find /app -mindepth 1 -maxdepth 1 ! -name package.json ! -name package-lock.json ! -name node_modules ! -name public ! -name .next ! -name data -exec rm -rf {} +; \
    find /app/data -mindepth 1 -maxdepth 1 ! -name mirror -exec rm -rf {} +

ENV NODE_ENV=production
ENV PORT=3000

USER node

EXPOSE 3000

CMD ["npm", "start"]
