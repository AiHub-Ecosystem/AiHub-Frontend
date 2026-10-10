# AiHub Frontend Runtime Image

ARG NODE_IMAGE=node:20-slim

# Production dependencies, installed into an empty tree. The build below installs
# the dev tree into /app and leaves it there; installing over it does not produce
# a clean result, so the runtime dependencies get a tree that starts empty.
#
# npm drops the unscoped dev entry points but leaves the scoped ones behind, so
# the tree is then trimmed to what the lockfile marks as production. That list is
# derived from the lockfile rather than written out here, so a new dev dependency
# is picked up automatically instead of needing an edit to this file.
#
# --os and --cpu keep the native binaries for the platform the image runs on. The
# lockfile also resolves the darwin, win32 and arm64 variants of sharp and the swc
# binary, and those are of no use on the server.
FROM ${NODE_IMAGE} AS deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev --ignore-scripts --libc=glibc --os=linux --cpu=x64; \
    node -e 'const fs=require("fs"),l=require("/app/package-lock.json").packages;const keep=new Set(Object.keys(l).filter(k=>!l[k].dev&&!l[k].devOptional).map(k=>k.replace(/^node_modules\//,"").split("/node_modules/")[0]));const rm=(p)=>fs.rmSync(p,{recursive:true,force:true});for(const d of fs.readdirSync("/app/node_modules")){if(d[0]===".")continue;if(d[0]==="@"){const p="/app/node_modules/"+d;for(const s of fs.readdirSync(p))if(!keep.has(d+"/"+s))rm(p+"/"+s);if(!fs.readdirSync(p).length)rm(p);}else if(!keep.has(d))rm("/app/node_modules/"+d);}'; \
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
    rm -rf /app/.next/cache/turbopack /app/.next/cache/.tsbuildinfo /app/.next/trace /app/.next/trace-build /app/.next/next-server.js.nft.json; \
    mkdir -p /app/.next/cache; \
    rm -rf /root/.npm

# The server reads the build output, the production dependencies, public/ and the
# mirrored pages. Everything else in the build tree stays behind.
FROM ${NODE_IMAGE} AS runtime

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/data ./data
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/package-lock.json ./package-lock.json

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ENV PORT=3000

USER node

EXPOSE 3000

CMD ["npm", "start"]