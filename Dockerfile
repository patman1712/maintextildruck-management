FROM node:20-bookworm-slim AS builder

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends poppler-utils && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/package.json /app/package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/api ./api
COPY --from=builder /app/public ./public
COPY --from=builder /app/vite.config.ts ./
COPY --from=builder /app/tsconfig*.json ./
COPY --from=builder /app/src ./src

ENV NODE_ENV=production
ENV NODE_OPTIONS="--max-old-space-size=512 --expose-gc"

CMD ["npm", "run", "start"]
