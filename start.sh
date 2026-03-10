#!/bin/bash
# DemoPlatform — start the full Docker stack
# Usage:
#   ./start.sh              # production mode  (nginx on :80, backend on :8000)
#   ./start.sh --dev        # development mode (Vite on :5173, backend with reload)
#   ./start.sh --down       # stop all containers
#   ./start.sh --down -v    # stop + wipe all data volumes

set -e
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# Require Docker
if ! command -v docker &> /dev/null; then
    echo "ERROR: Docker is not installed. Download from https://docs.docker.com/get-docker/"
    exit 1
fi

case "${1:-}" in
  --down)
    shift
    docker compose down "$@"
    ;;
  --dev)
    echo "=== DemoPlatform (DEV mode) ==="
    docker compose -f docker-compose.yml -f docker-compose.dev.yml up --build
    ;;
  *)
    echo "=== DemoPlatform ==="
    echo "First run: builds images and downloads Ollama models (~2.3 GB). Grab a coffee."
    echo ""
    docker compose up --build
    ;;
esac
