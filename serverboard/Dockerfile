# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

# Install libc6-compat, curl, and unzip
RUN apk add --no-cache libc6-compat curl unzip

# Install Render CLI (required for background provisioning and teardown tasks)
RUN ARCH=$(uname -m) \
    && if [ "$ARCH" = "x86_64" ]; then RENDER_ARCH="linux_amd64"; else RENDER_ARCH="linux_arm64"; fi \
    && mkdir -p /tmp/render-install \
    && curl -fsSL -o /tmp/render-install/render.zip "https://github.com/render-oss/cli/releases/download/v2.30.0/cli_2.30.0_${RENDER_ARCH}.zip" \
    && unzip -q /tmp/render-install/render.zip -d /tmp/render-install \
    && mv /tmp/render-install/cli_v* /usr/local/bin/render \
    && chmod +x /usr/local/bin/render \
    && rm -rf /tmp/render-install

WORKDIR /app

# Copy package descriptors and install production dependencies
COPY package.json ./
RUN npm install --omit=dev

# Copy serverboard application source code
COPY . ./

# Environment defaults
ENV NODE_ENV=production
ENV ENV_TYPE=prod
ENV PORT=4000


EXPOSE 4000

CMD ["node", "server.js"]
