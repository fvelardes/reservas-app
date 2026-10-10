# ---- Etapa 1 
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- Etapa 2
FROM nginxinc/nginx-unprivileged:1.27-alpine

ARG APP_VERSION=v1
ENV APP_VERSION=${APP_VERSION}

ENV API_HOST=reservas-api \
    API_PORT=3000 \
    NGINX_ENVSUBST_FILTER=^API_

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx/templates /etc/nginx/templates

EXPOSE 8080
