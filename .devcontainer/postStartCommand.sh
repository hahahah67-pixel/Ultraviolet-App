#!/bin/bash
# ── Fish Proxy — Codespace Auto-Start Script ──────────────────
# Runs automatically every time the codespace starts or resumes.
# Pulls latest code, installs deps, starts/restarts the server.

echo "🐟 Fish Proxy — starting up..."

cd ~/workspaces/Ultraviolet-App 2>/dev/null || cd /workspaces/Ultraviolet-App 2>/dev/null || {
  echo "[error] Could not find Fish Proxy directory."
  exit 1
}

echo "[1/4] Pulling latest code from GitHub..."
git pull

echo "[2/4] Installing dependencies..."
pnpm install

echo "[3/4] Starting Fish Proxy with PM2..."
if pm2 describe fish-proxy > /dev/null 2>&1; then
  pm2 restart fish-proxy
else
  PORT=8080 pm2 start src/index.js --name fish-proxy --restart-delay 3000 --max-restarts 10
fi

pm2 save

echo "[4/4] Done! Fish Proxy is running on port 8080."
pm2 status
