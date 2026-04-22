FROM node:20-bookworm-slim

# Installer dependances systeme necessaires aux modules natifs
RUN apt-get update && \
    apt-get install -y --no-install-recommends python3 make g++ && \
    rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NPM_CONFIG_FETCH_RETRIES=5 \
    NPM_CONFIG_FETCH_RETRY_MINTIMEOUT=20000 \
    NPM_CONFIG_FETCH_RETRY_MAXTIMEOUT=120000 \
    NPM_CONFIG_FETCH_TIMEOUT=180000 \
    NPM_CONFIG_NETWORK_CONCURRENCY=6 \
    NPM_CONFIG_MAXSOCKETS=12 \
    NPM_CONFIG_PROGRESS=false \
    NPM_CONFIG_UPDATE_NOTIFIER=false

WORKDIR /app

# Copier package files et installer dependances avec retry et nettoyage automatique
COPY package*.json .npmrc ./
RUN bash -ec '\
  mkdir -p /tmp/.npm; \
  for i in 1 2 3; do \
    (npm ci --cache /tmp/.npm --omit=dev --prefer-offline --no-audit --no-fund || npm install --cache /tmp/.npm --omit=dev --prefer-offline --no-audit --no-fund) && exit 0; \
    echo "npm install failed (attempt $i/3), cleaning and retrying..."; \
    npm cache clean --force || true; \
    rm -rf node_modules; \
    sleep $((i * 4)); \
  done; \
  exit 1'
RUN test -d node_modules

# Copier le code source
COPY . .

RUN mkdir -p public

# Verifier que le fichier MBTiles existe
RUN if [ ! -f osm-2020-02-10-v3.11_madagascar_antananarivo.mbtiles ]; then \
      echo "MBTiles non trouve"; \
    else \
      echo "MBTiles trouve"; \
    fi

EXPOSE 3000

CMD ["npm", "start"]
