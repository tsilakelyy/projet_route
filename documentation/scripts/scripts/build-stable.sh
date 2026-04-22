#!/usr/bin/env bash
set -euo pipefail

# Build mode stable: disable BuildKit frontend to avoid grpc/frontend crashes
export DOCKER_BUILDKIT=0
export COMPOSE_DOCKER_CLI_BUILD=0
export COMPOSE_PARALLEL_LIMIT=1

echo "[1/3] Stopping old containers..."
docker compose down --remove-orphans

echo "[2/3] Building images sequentially..."
docker compose build backend
docker compose build carte
docker compose build web

echo "[3/3] Starting stack..."
docker compose up -d

echo "OK: build stable termine."
