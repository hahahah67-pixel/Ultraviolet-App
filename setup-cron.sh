#!/bin/bash

# Fish Proxy - Auto Update Setup
# Run this once on your EC2 to enable automatic git pull every 30 minutes
# Usage: bash setup-cron.sh

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Setting up auto-update cron job for Fish Proxy..."
echo "Repo directory: $REPO_DIR"

# Modified: Add keep-alive loop to prevent Codespace suspension
(crontab -l 2>/dev/null; echo "*/30 * * * * cd $REPO_DIR && git pull >> $REPO_DIR/autoupdate.log 2>&1 && while true; do echo 'Keep-alive ping - preventing suspension'; sleep 300; done") | crontab -

echo "Done! Your site will now auto-pull from GitHub every 30 minutes."
echo "Keep-alive loop added to prevent Codespace suspension."
echo "You can check $REPO_DIR/autoupdate.log to see update history."
