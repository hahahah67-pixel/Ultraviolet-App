#!/bin/bash
# ── Fish Proxy — Codespace Auto-Start Script ──────────────────
set +e  # never exit on error — codespaces kills itself if this script fails
echo "🐟 Fish Proxy — starting up..."

# Install pnpm if missing
if ! command -v pnpm &>/dev/null; then
  echo "[*] Installing pnpm..."
  npm install -g pnpm 2>&1 || true
fi

# Install PM2 if missing
if ! command -v pm2 &>/dev/null; then
  echo "[*] Installing PM2..."
  npm install -g pm2 2>&1 || true
fi

# Clone or update Ultraviolet-App
if [ -d "/workspaces/Ultraviolet-App" ]; then
  echo "[*] Updating Ultraviolet-App..."
  cd /workspaces/Ultraviolet-App && git pull 2>&1 || true
else
  echo "[*] Cloning Ultraviolet-App..."
  cd /workspaces && git clone https://github.com/hahahah67-pixel/Ultraviolet-App.git 2>&1 || true
fi

cd /workspaces/Ultraviolet-App || { echo "[!] Could not cd into Ultraviolet-App"; exit 0; }

echo "[*] Installing dependencies..."
pnpm install 2>&1 || true

echo "[*] Starting Fish Proxy..."
pm2 delete fish-proxy 2>/dev/null || true
PORT=8080 pm2 start src/index.js \
  --name fish-proxy \
  --restart-delay 3000 \
  --max-restarts 10 2>&1 || true

pm2 save 2>&1 || true

echo ""
echo "✅ Done! Fish Proxy should be running on port 8080."
echo "🐟 URL: https://$CODESPACE_NAME-8080.app.github.dev"
exit 0
