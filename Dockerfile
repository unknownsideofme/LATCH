# syntax=docker/dockerfile:1
FROM node:20-alpine AS base

# Install libc6-compat for Next.js support on Alpine
RUN apk add --no-cache libc6-compat

WORKDIR /app

# Step 1: Install dependencies (leveraging layer cache)
COPY package.json package-lock.json ./
COPY mission-control/package.json ./mission-control/

RUN npm ci

# Step 2: Copy necessary source code
COPY backend/ ./backend/
COPY hooks/ ./hooks/
COPY cli/ ./cli/
COPY mission-control/ ./mission-control/
COPY docker-entrypoint.sh ./docker-entrypoint.sh


RUN chmod +x ./docker-entrypoint.sh

# Step 3: Build Mission Control UI for production
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build -w mission-control

# Step 4: Configure runtime environment
ENV NODE_ENV=production
ENV LATCH_PORT=3001
ENV LATCH_UI_ORIGIN=http://localhost:3002

EXPOSE 3001 3002

ENTRYPOINT ["./docker-entrypoint.sh"]
