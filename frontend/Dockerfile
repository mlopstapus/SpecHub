FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN npm install --os=linuxmusl --cpu=arm64 sharp@0.33 2>/dev/null || npm install sharp@0.33

COPY --from=builder --chown=1001:0 /app/public ./public
COPY --from=builder --chown=1001:0 /app/.next/standalone ./
COPY --from=builder --chown=1001:0 /app/.next/static ./.next/static

RUN chmod -R g=u /app

# BACKEND_URL is read at runtime by next.config.mjs rewrites().
# Override this per deployment (e.g. http://backend-app:8000 on OpenShift).
ENV BACKEND_URL=http://pcp:8000

USER 1001
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
