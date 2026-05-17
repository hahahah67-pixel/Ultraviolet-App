#!/bin/bash
# ── Fish Proxy — Codespace Auto-Start Script ──────────────────
echo "🐟 Fish Proxy — starting up..."

# Codespaces always puts the repo here
cd /workspaces/Ultraviolet-App || {
  echo "[error] Could not find /workspaces/Ultraviolet-App"
  exit 1
}

echo "[1/4] Pulling latest code..."
git pull

echo "[2/4] Installing dependencies..."
pnpm install

echo "[3/4] Starting PM2..."
if pm2 describe fish-proxy > /dev/null 2>&1; then
  pm2 restart fish-proxy
else
  PORT=8080 pm2 start src/index.js \
    --name fish-proxy \
    --restart-delay 3000 \
    --max-restarts 10
fi

pm2 save

echo "[4/4] Done!"
echo "🐟 Fish Proxy running at: https://$CODESPACE_NAME-8080.app.github.dev"
pm2 status
