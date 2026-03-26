# ─── Build Stage ─────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ─── Runtime Stage ───────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

# Copy built artifacts
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm ci --omit=dev

# Create statecli data directory
RUN mkdir -p /data/.statecli

# Environment
ENV NODE_ENV=production
ENV STATECLI_DATA_DIR=/data/.statecli
ENV STATECLI_NO_TELEMETRY=false

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "process.exit(0)" || exit 1

# Dashboard port (optional)
EXPOSE 4000

# Start enhanced MCP server (HTTPS transport mode)
CMD ["node", "dist/enhanced-mcp-server.js"]
