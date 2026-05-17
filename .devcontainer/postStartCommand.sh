#!/bin/bash
# ── Fish Proxy — Codespace Auto-Start Script ──────────────────
echo "🐟 Fish Proxy — starting up..."

cd /workspaces/Ultraviolet-App || {
  echo "[error] Could not find /workspaces/Ultraviolet-App"
  exit 1
}

echo "[1/5] Checking pnpm..."
if ! command -v pnpm &>/dev/null; then
  echo "      pnpm not found — installing..."
  npm install -g pnpm
else
  echo "      pnpm ok ✓"
fi

echo "[2/5] Checking PM2..."
if ! command -v pm2 &>/dev/null; then
  echo "      PM2 not found — installing..."
  npm install -g pm2
else
  echo "      PM2 ok ✓"
fi

echo "[3/5] Pulling latest code..."
git pull

echo "[4/5] Installing dependencies..."
pnpm install

echo "[5/5] Starting Fish Proxy..."
pm2 delete fish-proxy 2>/dev/null || true
PORT=8080 pm2 start src/index.js \
  --name fish-proxy \
  --restart-delay 3000 \
  --max-restarts 10

pm2 save

echo ""
echo "✅ Fish Proxy is running!"
echo "🐟 Your proxy URL: https://$CODESPACE_NAME-8080.app.github.dev"
echo ""
pm2 status
