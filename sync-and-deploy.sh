#!/bin/bash
# sync-and-deploy.sh — sync local code to the server and redeploy
# Run this from your dev machine: bash sync-and-deploy.sh
#
# Server details live in .deploy.env (gitignored), e.g.:
#   DEPLOY_SERVER="user@your-server"
#   DEPLOY_DIR="~/close-circle-v2"
#   DEPLOY_URL="https://your-host.example.ts.net"
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [[ -f "$SCRIPT_DIR/.deploy.env" ]]; then
  # shellcheck source=/dev/null
  source "$SCRIPT_DIR/.deploy.env"
fi

SERVER="${DEPLOY_SERVER:?Set DEPLOY_SERVER in .deploy.env}"
REMOTE_DIR="${DEPLOY_DIR:-~/close-circle-v2}"

echo "[sync] pushing code to server..."
rsync -avz --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='dist' \
  --exclude='api/.env' \
  --exclude='.deploy.env' \
  --exclude='backups' \
  --exclude='*.csv' \
  ./ "${SERVER}:${REMOTE_DIR}/"

echo "[deploy] rebuilding containers on server..."
ssh "$SERVER" "cd ${REMOTE_DIR} && bash deploy.sh"

echo "[done] app is live${DEPLOY_URL:+ at $DEPLOY_URL}"
