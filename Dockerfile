# Multi-stage Dockerfile for Semem
# Semantic Memory for Intelligent Agents

# Stage 1: Builder - Install dependencies and build assets
FROM node:22-alpine AS builder

# Install build dependencies for native modules
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    py3-setuptools

# Set working directory
WORKDIR /app

# Copy package files first for better layer caching
COPY package*.json ./

# Install all dependencies (including devDependencies for building)
RUN npm ci --include=dev --frozen-lockfile

# Copy source code
COPY . .

# Build frontend assets (workbench and any other frontend builds)
RUN npm run build

# Remove dev dependencies to reduce size
RUN npm prune --production

# Stage 2: Runtime - Create lean production image
FROM node:22-alpine AS runtime

# Install system dependencies needed for the application
RUN apk add --no-cache \
    bash \
    curl \
    tini \
    && addgroup -g 1001 -S semem \
    && adduser -S semem -u 1001 -G semem

# Set working directory
WORKDIR /app

# Copy package files and node_modules from builder
COPY --from=builder --chown=semem:semem /app/package*.json ./
COPY --from=builder --chown=semem:semem /app/node_modules ./node_modules

# Copy application source code
COPY --from=builder --chown=semem:semem /app/src ./src
COPY --from=builder --chown=semem:semem /app/mcp ./mcp
COPY --from=builder --chown=semem:semem /app/bin ./bin
COPY --from=builder --chown=semem:semem /app/index.js ./
COPY --from=builder --chown=semem:semem /app/start.sh ./
COPY --from=builder --chown=semem:semem /app/stop.sh ./

# Copy configuration and scripts
COPY --from=builder --chown=semem:semem /app/config ./config
COPY --from=builder --chown=semem:semem /app/scripts ./scripts
COPY --from=builder --chown=semem:semem /app/prompts ./prompts
COPY --from=builder --chown=semem:semem /app/sparql ./sparql

# Copy built assets (if any)
COPY --from=builder --chown=semem:semem /app/dist ./dist

# Create necessary directories with proper permissions
RUN mkdir -p /app/logs /app/data /app/tmp \
    && chown -R semem:semem /app

# Copy and set up entrypoint script
COPY scripts/docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
    && chmod +x /app/start.sh \
    && chmod +x /app/stop.sh

# Expose ports for all services
EXPOSE 4100 4101 4102

# Set environment variables
ENV NODE_ENV=production \
    NODE_OPTIONS="--max-old-space-size=2048" \
    PORT=4100 \
    SEMEM_CONFIG_PATH=/app/config/config.json

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:4100/health || exit 1

# Switch to non-root user
USER semem

# Use tini as init system for proper signal handling
ENTRYPOINT ["/sbin/tini", "--", "/usr/local/bin/docker-entrypoint.sh"]

# Default command
CMD ["npm", "start"]