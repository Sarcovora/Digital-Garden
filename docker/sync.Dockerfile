FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends git openssh-client ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
# npm's postinstall hook (scripts/copy-assets.mjs) must exist before `npm ci` runs
COPY scripts/copy-assets.mjs scripts/copy-assets.mjs
RUN npm ci --no-audit --no-fund
COPY . .
# Quartz writes its cache next to the code; the container runs as the host user (GARDEN_UID), not root.
RUN mkdir -p /app/quartz/.quartz-cache /app/.quartz-cache && chmod -R a+rwX /app/quartz/.quartz-cache /app/.quartz-cache
ENV DATA_DIR=/data VAULT_DIR=/vault PORT=3000 HOME=/tmp NODE_ENV=production
EXPOSE 3000
CMD ["node", "sync/src/server.mjs"]
