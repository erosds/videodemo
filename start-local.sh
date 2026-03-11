#!/bin/bash
# DemoPlatform — run the full stack locally (no Docker required)
#
# Usage:
#   ./start-local.sh              # start backend + frontend
#   ./start-local.sh --with-rag   # also start Qdrant + Ollama (Chemical Compliance tab)
#   ./start-local.sh --install    # (re-)install all dependencies, then start
#
# Requirements:
#   - Python 3.10+
#   - Node.js 18+
#   - (optional) Docker — only needed for --with-rag (Qdrant + Ollama)

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

BACKEND_DIR="$PROJECT_DIR/backend"
VENV_DIR="$BACKEND_DIR/.venv"
DATASETS_DIR="$BACKEND_DIR/datasets/molecule_finder"

WITH_RAG=false
DO_INSTALL=false

for arg in "$@"; do
  case "$arg" in
    --with-rag)  WITH_RAG=true ;;
    --install)   DO_INSTALL=true ;;
  esac
done

# ── Colour helpers ────────────────────────────────────────────────────────────
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
CYAN='\033[0;36m'; BOLD='\033[1m'; RESET='\033[0m'
info()    { echo -e "${CYAN}[info]${RESET}  $*"; }
ok()      { echo -e "${GREEN}[ok]${RESET}    $*"; }
warn()    { echo -e "${YELLOW}[warn]${RESET}  $*"; }
die()     { echo -e "${RED}[error]${RESET} $*"; exit 1; }
section() { echo -e "\n${BOLD}=== $* ===${RESET}"; }

# ── Prerequisite checks ───────────────────────────────────────────────────────
section "Checking prerequisites"

command -v python3 &>/dev/null || die "Python 3 not found. Install from https://python.org"
PY_VER=$(python3 -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
PY_MAJOR=$(echo "$PY_VER" | cut -d. -f1)
PY_MINOR=$(echo "$PY_VER" | cut -d. -f2)
[[ "$PY_MAJOR" -eq 3 && "$PY_MINOR" -ge 10 ]] || die "Python 3.10+ required (found $PY_VER)"
ok "Python $PY_VER"

command -v node &>/dev/null || die "Node.js not found. Install from https://nodejs.org"
NODE_VER=$(node -e "process.stdout.write(process.versions.node)")
ok "Node $NODE_VER"

command -v npm &>/dev/null || die "npm not found."

# LightGBM on macOS requires libomp (OpenMP runtime)
if [[ "$(uname)" == "Darwin" ]]; then
  if ! [ -f "/opt/homebrew/opt/libomp/lib/libomp.dylib" ] && ! [ -f "/usr/local/opt/libomp/lib/libomp.dylib" ]; then
    if command -v brew &>/dev/null; then
      info "libomp not found — installing via Homebrew (required by LightGBM) …"
      brew install libomp
      ok "libomp installed"
    else
      die "libomp not found and Homebrew not available.\nInstall Homebrew (https://brew.sh) then run: brew install libomp"
    fi
  else
    ok "libomp present"
  fi
fi

if $WITH_RAG; then
  command -v docker &>/dev/null || die "--with-rag requires Docker (for Qdrant + Ollama)"
  ok "Docker available"
fi

# ── Python venv + dependencies ────────────────────────────────────────────────
section "Python environment"

if [[ ! -d "$VENV_DIR" || "$DO_INSTALL" == true ]]; then
  info "Creating virtual environment at backend/.venv …"
  python3 -m venv "$VENV_DIR"
  DO_INSTALL=true   # venv is fresh — always install
fi

PY="$VENV_DIR/bin/python"
PIP="$VENV_DIR/bin/pip"

if $DO_INSTALL; then
  info "Installing Python dependencies (this may take a few minutes) …"
  "$PIP" install --quiet --upgrade pip
  "$PIP" install --quiet -r "$BACKEND_DIR/requirements.txt"
  ok "Python dependencies installed"
else
  ok "Using existing venv (run with --install to refresh)"
fi

# ── Node dependencies ─────────────────────────────────────────────────────────
section "Node dependencies"

if [[ ! -d "$PROJECT_DIR/node_modules" || "$DO_INSTALL" == true ]]; then
  info "Running npm install …"
  npm install --silent
  ok "Node dependencies installed"
else
  ok "node_modules present (run with --install to refresh)"
fi

# ── Dataset / pool directories ────────────────────────────────────────────────
section "Data directories"

mkdir -p "$DATASETS_DIR/pools"
mkdir -p "$DATASETS_DIR/models"
ok "Dataset dirs ready at backend/datasets/molecule_finder/"

# ── Optional: Qdrant + Ollama via Docker (--with-rag) ─────────────────────────
QDRANT_URL="http://localhost:6333"
OLLAMA_URL="http://localhost:11434"

if $WITH_RAG; then
  section "Starting Qdrant + Ollama (--with-rag)"

  # Qdrant
  if ! docker ps --format '{{.Names}}' | grep -q "^demoplatform-qdrant$"; then
    info "Starting Qdrant container …"
    docker run -d --name demoplatform-qdrant \
      -p 6333:6333 -p 6334:6334 \
      -v demoplatform_qdrant_data:/qdrant/storage \
      qdrant/qdrant:latest &>/dev/null
    sleep 3
  fi
  ok "Qdrant at $QDRANT_URL"

  # Ollama
  if ! docker ps --format '{{.Names}}' | grep -q "^demoplatform-ollama$"; then
    info "Starting Ollama container …"
    docker run -d --name demoplatform-ollama \
      -p 11434:11434 \
      -v demoplatform_ollama_data:/root/.ollama \
      ollama/ollama:latest &>/dev/null
    sleep 3
    info "Pulling llama3.2 + nomic-embed-text (first run only, ~2 GB) …"
    docker exec demoplatform-ollama ollama pull llama3.2 &
    docker exec demoplatform-ollama ollama pull nomic-embed-text &
  fi
  ok "Ollama at $OLLAMA_URL"
fi

# ── Process management ────────────────────────────────────────────────────────
PIDS=()

cleanup() {
  echo ""
  section "Shutting down"
  for pid in "${PIDS[@]}"; do
    kill "$pid" 2>/dev/null && info "Stopped PID $pid"
  done
  if $WITH_RAG; then
    warn "Qdrant + Ollama containers left running. Stop with:"
    warn "  docker stop demoplatform-qdrant demoplatform-ollama"
  fi
  exit 0
}
trap cleanup INT TERM

# ── Backend ───────────────────────────────────────────────────────────────────
section "Starting backend"

export ML_DATASETS_DIR="$DATASETS_DIR"
export QDRANT_URL="$QDRANT_URL"
export OLLAMA_URL="$OLLAMA_URL"
export CORS_ORIGINS="http://localhost:5173,http://localhost:3000,http://localhost"

cd "$BACKEND_DIR"
"$VENV_DIR/bin/uvicorn" app.main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --reload \
  --log-level info \
  2>&1 | sed 's/^/[backend] /' &
PIDS+=($!)
cd "$PROJECT_DIR"

# Give the backend a moment to bind
sleep 2

# ── Frontend ──────────────────────────────────────────────────────────────────
section "Starting frontend"

npm run start -- --host 0.0.0.0 2>&1 | sed 's/^/[frontend] /' &
PIDS+=($!)

# ── Ready ─────────────────────────────────────────────────────────────────────
echo ""
echo -e "${GREEN}${BOLD}DemoPlatform running locally${RESET}"
echo -e "  Frontend  →  ${CYAN}http://localhost:5173${RESET}"
echo -e "  Backend   →  ${CYAN}http://localhost:8000${RESET}"
if $WITH_RAG; then
  echo -e "  Qdrant    →  ${CYAN}http://localhost:6333${RESET}"
  echo -e "  Ollama    →  ${CYAN}http://localhost:11434${RESET}"
fi
echo -e "\nPress ${BOLD}Ctrl+C${RESET} to stop all services."
echo ""

wait
