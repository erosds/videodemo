@echo off
chcp 65001 >nul
setlocal EnableDelayedExpansion

echo === DemoPlatform ===
echo.

:: Verify Docker is installed and running
where docker >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker not found in PATH.
    echo Download Docker Desktop from https://docs.docker.com/get-docker/
    pause
    exit /b 1
)

docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo ERROR: Docker daemon is not running.
    echo Start Docker Desktop and try again.
    pause
    exit /b 1
)

set MODE=%1

if /I "%MODE%"=="--down" (
    shift
    docker compose down %*
    goto :eof
)

if /I "%MODE%"=="--dev" (
    echo Starting in DEV mode ^(Vite hot-reload on :5173^)...
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
    goto :eof
)

echo Starting in PRODUCTION mode...
echo First run: builds images and downloads Ollama models (~2.3 GB). Grab a coffee.
echo.
docker compose up --build

endlocal
