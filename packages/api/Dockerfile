# Backend Dockerfile - Billova API
# Using Debian slim for better Prisma/OpenSSL compatibility
FROM node:18-slim

WORKDIR /app

# Install dependencies for native modules and OpenSSL
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    openssl \
    wget \
    && rm -rf /var/lib/apt/lists/*

# Copy package files from root and packages
COPY package*.json ./
COPY packages/api/package*.json ./packages/api/
COPY packages/database/package*.json ./packages/database/

# Install all dependencies
RUN npm ci --workspace=packages/api --workspace=packages/database

# Copy source code
COPY packages/api ./packages/api
COPY packages/database ./packages/database

# Generate Prisma client
RUN npm run db:generate

# Build the API
WORKDIR /app/packages/api
RUN npm run build

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/health || exit 1

# Start the server
CMD ["node", "dist/index.js"]
