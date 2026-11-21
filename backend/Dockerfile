FROM node:20-slim AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-slim
WORKDIR /app
ENV NODE_ENV=production

ARG APP_VERSION=v1
ENV APP_VERSION=${APP_VERSION}

COPY --from=deps /app/node_modules ./node_modules
COPY . .

USER node
EXPOSE 3000
CMD ["node","server.js"]
