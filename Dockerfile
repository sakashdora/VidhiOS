# Multi-stage production build for VidhiOS
FROM node:22-slim AS builder

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install all dependencies (including devDependencies needed for build)
RUN npm install

# Copy application source code
COPY . .

# Build Vite frontend and bundle server.js
RUN npm run build

# Production runtime container
FROM node:22-slim AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# Copy package definitions and install only production dependencies
COPY package*.json ./
RUN npm install --omit=dev

# Copy compiled frontend and bundled server from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.js ./server.js

# Create data directory for durable store
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["node", "server.js"]
