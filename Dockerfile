# AiHub Frontend Runtime Image

ARG NODE_IMAGE=node:20-slim

FROM ${NODE_IMAGE}

WORKDIR /app

ARG NEXT_PUBLIC_API_URL=https://api.aihubproduction.com
ARG NEXT_BUILD_ID
ARG SOURCE_DATE_EPOCH
ENV NEXT_TELEMETRY_DISABLED=1

# Two installs on purpose. The first brings the dev tree for the build; the
# second reinstalls node_modules as production-only. `npm prune --omit=dev`
# removed the dev entry points but left their transitive tree behind, so the
# image was still carrying eslint, tailwind and playwright.
#
# The playwright directories go afterwards: next declares @playwright/test as an
# optional peer, so the lockfile marks the subtree devOptional and --omit=dev
# keeps it. --omit=optional would drop it along with the @next/swc binary Next
# needs to run, so only the test runner is removed.
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
    npm ci --omit=dev --ignore-scripts --libc=glibc; \
    rm -rf /app/node_modules/@playwright /app/node_modules/playwright /app/node_modules/playwright-core; \
    if [ -n "${SOURCE_DATE_EPOCH:-}" ]; then \
      rm -rf /app/.next/cache/turbopack /app/.next/cache/.tsbuildinfo /app/.next/trace /app/.next/trace-build /app/.next/next-server.js.nft.json; \
      mkdir -p /app/.next/cache; \
    fi; \
    rm -rf /root/.npm; \
    find /app -mindepth 1 -maxdepth 1 ! -name package.json ! -name package-lock.json ! -name node_modules ! -name public ! -name .next ! -name data -exec rm -rf {} +; \
    find /app/data -mindepth 1 -maxdepth 1 ! -name mirror -exec rm -rf {} +

ENV NODE_ENV=production
ENV PORT=3000

USER node

EXPOSE 3000

CMD ["npm", "start"]
