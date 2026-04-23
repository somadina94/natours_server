# Stage 1: Build
FROM node:22-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json tsconfig*.json ./

# Install all dependencies including devDependencies
RUN npm install --legacy-peer-deps

# Copy source code
COPY src ./src

# Compile TypeScript
RUN npm run build

# Stage 2: Production image
FROM node:22-alpine

WORKDIR /app

# Copy built files and production dependencies
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./
RUN npm install --only=production --legacy-peer-deps

# Expose port
ENV NODE_ENV=production
ENV PORT=4040
EXPOSE 4040

# Create logs directory
RUN mkdir -p /app/logs

# Start the server
CMD ["node", "dist/server.js"]
