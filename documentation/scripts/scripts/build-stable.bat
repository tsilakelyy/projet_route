@echo off
setlocal

REM Build mode stable: disable BuildKit frontend to avoid grpc/frontend crashes
set DOCKER_BUILDKIT=0
set COMPOSE_DOCKER_CLI_BUILD=0
set COMPOSE_PARALLEL_LIMIT=1

echo [1/3] Stopping old containers...
docker compose down --remove-orphans

echo [2/3] Building images sequentially...
docker compose build backend
if errorlevel 1 goto :fail
docker compose build carte
if errorlevel 1 goto :fail
docker compose build web
if errorlevel 1 goto :fail

echo [3/3] Starting stack...
docker compose up -d
if errorlevel 1 goto :fail

echo.
echo OK: build stable termine.
exit /b 0

:fail
echo.
echo ERREUR: echec build/deploiement.
exit /b 1
