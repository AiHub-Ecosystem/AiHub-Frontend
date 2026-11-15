# AiHub Frontend Runtime Image

ARG NODE_IMAGE=node:20-slim

# Production dependencies, installed into an empty tree. The build below installs
# the dev tree into /app and leaves it there; installing over it does not produce
# a clean result, so the runtime dependencies get a tree that starts empty.
#
# npm drops the unscoped dev entry points but leaves the scoped ones behind, so
# the tree is trimmed to what the lockfile marks as production. That list is
# derived from the lockfile rather than written out here, so a new dev dependency
# is picked up automatically instead of needing an edit to this file. The same
# script produces the expected listing that CI compares the built image against,
# so the tree and its check cannot drift apart.
FROM ${NODE_IMAGE} AS deps

WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/customer-web/package.json apps/customer-web/package.json
COPY apps/landing/package.json apps/landing/package.json
COPY scripts/prod-dependencies.mjs ./scripts/

RUN npm ci --omit=dev --ignore-scripts --libc=glibc; \
    node scripts/prod-dependencies.mjs --prune; \
    rm -rf /root/.npm

FROM ${NODE_IMAGE} AS builder

WORKDIR /app

ARG NEXT_PUBLIC_API_URL=https://api.aihubproduction.com
ARG NEXT_BUILD_ID
ARG SOURCE_DATE_EPOCH
ENV NEXT_TELEMETRY_DISABLED=1

# `npm prune --omit=dev` was what this used to do. It removed the dev entry points
# and left their transitive tree behind, so the image still carried eslint,
# tailwind, vitest and playwright. Nothing from this stage is copied into the
# runtime image any more, so the dev tree only costs build time here.
#
# The build artefacts are dropped for every build, not only the reproducible ones.
# The Turbopack cache was previously left in production images, which the server
# never reads but the VPS still had to download.
RUN --mount=type=bind,target=/source \
    --mount=type=secret,id=next_server_actions_key,required=false \
    --mount=type=secret,id=next_preview_info,required=false \
    --mount=type=secret,id=next_rsc_info,required=false \
    set -eu; \
    cp -a /source/. /app/; \
    npm ci --ignore-scripts --libc=glibc; \
    if [ -f /run/secrets/next_preview_info ]; then \
      mkdir -p apps/customer-web/.next/cache && cp /run/secrets/next_preview_info apps/customer-web/.next/cache/.previewinfo; \
    fi; \
    if [ -f /run/secrets/next_rsc_info ]; then \
      mkdir -p apps/customer-web/.next/cache && cp /run/secrets/next_rsc_info apps/customer-web/.next/cache/.rscinfo; \
    fi; \
    if [ -f /run/secrets/next_server_actions_key ]; then \
      NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$(cat /run/secrets/next_server_actions_key)" npm run build:web; \
    else \
      npm run build:web; \
    fi; \
    rm -rf /app/apps/customer-web/.next/cache/turbopack /app/apps/customer-web/.next/cache/.tsbuildinfo /app/apps/customer-web/.next/trace /app/apps/customer-web/.next/trace-build /app/apps/customer-web/.next/next-server.js.nft.json; \
    mkdir -p /app/apps/customer-web/.next/cache; \
    rm -rf /root/.npm

# The server reads the build output, the production dependencies, public/ and the
# mirrored pages. Everything else in the build tree stays behind.
FROM ${NODE_IMAGE} AS runtime

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/apps/customer-web/.next ./apps/customer-web/.next
COPY --from=builder /app/apps/customer-web/public ./apps/customer-web/public
COPY --from=builder /app/apps/customer-web/data ./apps/customer-web/data
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json
COPY --from=builder /app/apps/customer-web/package.json ./apps/customer-web/package.json

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PORT=3000

USER node

EXPOSE 3000

CMD ["npm", "run", "start:web"]
