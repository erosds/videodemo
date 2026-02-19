#!/bin/bash

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Avvio VideDemo ==="

# Backend (FastAPI)
echo "[1/2] Avvio backend FastAPI..."
cd "$PROJECT_DIR/backend"
uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!
echo "    Backend PID: $BACKEND_PID"

# Frontend (React)
echo "[2/2] Avvio frontend React..."
cd "$PROJECT_DIR"
npm start &
FRONTEND_PID=$!
echo "    Frontend PID: $FRONTEND_PID"

echo ""
echo "App in esecuzione:"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:8000"
echo ""
echo "Premi Ctrl+C per fermare tutto."

# Ferma entrambi i processi all'uscita
trap "echo ''; echo 'Arresto...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit 0" INT TERM

wait
