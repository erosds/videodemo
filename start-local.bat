@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul

echo === Avvio DemoPlatform ===
echo.

set PROJECT_DIR=%~dp0
set VENV_PYTHON=%PROJECT_DIR%backend\.venv\Scripts\python.exe
set VENV_PIP=%PROJECT_DIR%backend\.venv\Scripts\pip.exe

:: ── [0/5] Pulizia processi residui ────────────────────────────────────────────
echo [0/5] Pulizia processi residui...

:: Kill uvicorn supervisors (python -m uvicorn ...)
powershell -NoProfile -Command ^
  "Get-CimInstance Win32_Process | Where-Object { $_.Name -like 'python*' -and $_.CommandLine -like '*uvicorn*' } | ForEach-Object { Write-Host ('  stop PID ' + $_.ProcessId + ' (uvicorn)'); Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

:: Kill orphaned uvicorn multiprocessing workers (parent_pid= pattern)
powershell -NoProfile -Command ^
  "Get-CimInstance Win32_Process | Where-Object { $_.Name -like 'python*' -and $_.CommandLine -like '*multiprocessing*' -and $_.CommandLine -like '*spawn_main*' } | ForEach-Object { Write-Host ('  stop PID ' + $_.ProcessId + ' (uvicorn worker)'); Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

powershell -NoProfile -Command ^
  "Get-CimInstance Win32_Process | Where-Object { $_.Name -like 'node*' -and $_.CommandLine -like '*vite*' } | ForEach-Object { Write-Host ('  stop PID ' + $_.ProcessId + ' (vite)'); Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"

for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":8000 " ^| findstr "LISTENING"') do (
    echo   stop PID %%a (porta 8000)
    taskkill /PID %%a /F /T >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":5173 " ^| findstr "LISTENING"') do (
    echo   stop PID %%a (porta 5173)
    taskkill /PID %%a /F /T >nul 2>&1
)

set _w=0
:wait_ports
powershell -NoProfile -Command ^
  "if ((Get-NetTCPConnection -LocalPort 8000 -EA SilentlyContinue) -or (Get-NetTCPConnection -LocalPort 5173 -EA SilentlyContinue)) { exit 1 } else { exit 0 }"
if %errorlevel% equ 0 goto ports_ok
set /a _w+=1
if %_w% lss 10 ( timeout /t 1 /nobreak >nul & goto wait_ports )
echo   Attenzione: porte ancora occupate, procedo comunque.
:ports_ok
echo   Porte liberate.
echo.

:: ── [1/5] Qdrant (WSL) ────────────────────────────────────────────────────────
echo [1/5] Qdrant — attesa su http://localhost:6333 (avvialo tu da WSL)...

set _q=0
:wait_qdrant
curl -s http://localhost:6333/healthz >nul 2>&1
if %errorlevel% equ 0 goto qdrant_ok
set /a _q+=1
if %_q% lss 30 ( timeout /t 2 /nobreak >nul & goto wait_qdrant )
echo   ERRORE: Qdrant non raggiungibile su :6333 dopo 60s.
echo   Avvia Docker da WSL con: docker compose up -d
pause
exit /b 1
:qdrant_ok
echo   Qdrant: http://localhost:6333
echo.

:: ── [2/5] Ollama — server + modelli ──────────────────────────────────────────
echo [2/5] Ollama...

where ollama >nul 2>&1
if %errorlevel% neq 0 (
    echo   ERRORE: ollama non trovato in PATH.
    echo   Scarica e installa da: https://ollama.com/download/windows
    echo   Poi riavvia questo script.
    pause
    exit /b 1
)
for /f "delims=" %%i in ('where ollama 2^>nul') do ( set "OLLAMA_EXE=%%i" & goto :ollama_path_ok )
:ollama_path_ok

:: Avvia il server solo se non e' gia' in ascolto
curl -s http://localhost:11434/api/tags >nul 2>&1
if %errorlevel% neq 0 (
    echo   Avvio server Ollama...
    start /B "" ollama serve
    set _o=0
    :wait_ollama
    timeout /t 2 /nobreak >nul
    curl -s http://localhost:11434/api/tags >nul 2>&1
    if %errorlevel% neq 0 (
        set /a _o+=1
        if !_o! lss 15 goto wait_ollama
        echo   ERRORE: Ollama non risponde dopo 30s.
        pause
        exit /b 1
    )
    echo   Server Ollama avviato.
) else (
    echo   Server Ollama gia' in ascolto.
)

:: Controllo modelli via API HTTP (piu' affidabile di "ollama list")
curl -s "http://localhost:11434/api/tags" > "%TEMP%\ollama_tags.txt" 2>nul

findstr /I "llama3.2" "%TEMP%\ollama_tags.txt" >nul 2>&1
if %errorlevel% neq 0 (
    echo   Pulling llama3.2 (~2 GB - solo al primo avvio, attendere...
    "%OLLAMA_EXE%" pull llama3.2
    if %errorlevel% neq 0 (
        echo   ERRORE: pull llama3.2 fallito.
        pause
        exit /b 1
    )
) else (
    echo   llama3.2 presente.
)

findstr /I "nomic-embed-text" "%TEMP%\ollama_tags.txt" >nul 2>&1
if %errorlevel% neq 0 (
    echo   Pulling nomic-embed-text (~300 MB - solo al primo avvio, attendere...
    "%OLLAMA_EXE%" pull nomic-embed-text
    if %errorlevel% neq 0 (
        echo   ERRORE: pull nomic-embed-text fallito.
        pause
        exit /b 1
    )
) else (
    echo   nomic-embed-text presente.
)
del "%TEMP%\ollama_tags.txt" >nul 2>&1
echo   Modelli OK.
echo.

:: ── [3/5] Python venv + dipendenze ───────────────────────────────────────────
echo [3/5] Dipendenze backend...

if not exist "%VENV_PYTHON%" (
    echo   Creazione virtualenv...
    python -m venv "%PROJECT_DIR%backend\.venv"
    if %errorlevel% neq 0 (
        echo   ERRORE: creazione venv fallita. Verifica che Python 3.10+ sia installato.
        pause
        exit /b 1
    )
)

echo   Installazione/aggiornamento pacchetti (solo modifiche)...
"%VENV_PIP%" install -r "%PROJECT_DIR%backend\requirements.txt" -q --no-warn-script-location
if %errorlevel% neq 0 (
    echo   ERRORE: pip install fallito. Controlla requirements.txt.
    pause
    exit /b 1
)
echo   Dipendenze OK.
echo.

:: ── [4/5] Backend (FastAPI) ───────────────────────────────────────────────────
echo [4/5] Avvio backend...
start "Backend - DemoPlatform" cmd /k "cd /d %PROJECT_DIR%backend && %VENV_PYTHON% -m uvicorn app.main:app --reload --port 8000"

set _t=0
:wait_backend
timeout /t 1 /nobreak >nul
curl -s -o nul http://localhost:8000/ 2>nul
if %errorlevel% equ 0 ( echo   Backend pronto. & goto start_frontend )
set /a _t+=1
if %_t% lss 20 goto wait_backend
echo   Backend non risponde dopo 20s — controlla la finestra Backend.

:: ── [5/5] Frontend (React/Vite) ──────────────────────────────────────────────
:start_frontend
echo.
echo [5/5] Avvio frontend...
start "Frontend - DemoPlatform" cmd /k "cd /d %PROJECT_DIR% && npm start"

echo.
echo  ╔════════════════════════════════════╗
echo  ║  DemoPlatform avviato              ║
echo  ║  Frontend : http://localhost:5173  ║
echo  ║  Backend  : http://localhost:8000  ║
echo  ║  Qdrant   : http://localhost:6333  ║
echo  ╚════════════════════════════════════╝
echo.

endlocal
