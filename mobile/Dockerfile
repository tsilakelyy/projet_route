# Build stage
FROM node:22-bookworm-slim AS build

ENV NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_FETCH_TIMEOUT=180000 \
    NPM_CONFIG_NETWORK_CONCURRENCY=6 \
    NPM_CONFIG_MAXSOCKETS=12 \
    NPM_CONFIG_PROGRESS=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false \
    CYPRESS_INSTALL_BINARY=0

WORKDIR /app

# Copier package files et installer dependances avec retry et nettoyage automatique
COPY package*.json .npmrc ./
RUN bash -ec '\
  mkdir -p /tmp/.npm; \
  for i in 1 2 3; do \
    (npm ci --cache /tmp/.npm --prefer-offline --legacy-peer-deps --no-audit --no-fund || npm install --cache /tmp/.npm --prefer-offline --legacy-peer-deps --no-audit --no-fund) && exit 0; \
    echo "npm install failed (attempt $i/3), cleaning and retrying..."; \
    npm cache clean --force || true; \
    rm -rf node_modules; \
    sleep $((i * 4)); \
  done; \
  exit 1'
RUN test -d node_modules
RUN npm install @rollup/rollup-linux-x64-gnu@4.55.2 --prefer-offline --no-audit --no-fund || true

# Copier le code source
COPY . .

# Build the app (lighter profile for constrained Docker environments)
RUN npm run build:docker

# Production stage
FROM nginx:alpine

WORKDIR /usr/share/nginx/html

# Copier le build genere
COPY --from=build /app/dist/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
