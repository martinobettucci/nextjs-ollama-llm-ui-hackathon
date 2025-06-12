# Use Node.js as the base image
FROM node:20-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

# Set a build-time argument for OLLAMA_URL with a default value
ARG OLLAMA_URL=http://127.0.0.1:11434
ENV OLLAMA_URL=${OLLAMA_URL}

COPY . .

RUN npm run build

FROM node:20-alpine

WORKDIR /app

# Copy the standalone output from Next.js build
COPY --from=builder /app/.next/standalone ./
# Copy static files
COPY --from=builder /app/.next/static ./.next/static  
# Copy public folder
COPY --from=builder /app/public ./public

# Set environment variable with a default value that can be overridden at runtime
ENV OLLAMA_URL=http://127.0.0.1:11434
ENV PORT=3000

EXPOSE 3000

CMD ["node", "server.js"]