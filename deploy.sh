#!/bin/bash
# deploy.sh — rebuild and restart all containers (run on the server after syncing code)
set -e

REPO_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$REPO_DIR"

echo "[deploy] building and restarting containers..."
docker compose up --build -d

echo "[deploy] done. Container status:"
docker compose ps
