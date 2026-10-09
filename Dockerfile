# ==========================================
# AiHub Frontend Multi-stage Dockerfile
# ==========================================

ARG NODE_IMAGE=node:20-slim

FROM ${NODE_IMAGE} AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci --ignore-scripts

COPY . .

# Next.js build args
ARG NEXT_PUBLIC_API_URL=https://api.aihubproduction.com
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
ARG NEXT_BUILD_ID

RUN --mount=type=secret,id=next_server_actions_key,required=false \
    if [ -f /run/secrets/next_server_actions_key ]; then \
      NEXT_SERVER_ACTIONS_ENCRYPTION_KEY="$(cat /run/secrets/next_server_actions_key)" npm run build; \
    else \
      npm run build; \
    fi
RUN npm prune --omit=dev

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
