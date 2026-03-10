#!/bin/sh
set -e

QDRANT_URL="${QDRANT_URL:-http://qdrant:6333}"

echo "[backend] Waiting for Qdrant at ${QDRANT_URL}..."
until curl -sf "${QDRANT_URL}/healthz" > /dev/null 2>&1; do
    printf "."
    sleep 2
done
echo
echo "[backend] Qdrant ready."

exec uvicorn app.main:app \
    --host 0.0.0.0 \
    --port 8000 \
    --workers 1
