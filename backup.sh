#!/bin/bash
# Close Circle v2 — DuckDB backup script
# Stops the API briefly, copies the DB to a timestamped file, restarts.
# Usage: ./backup.sh [--keep-days N]  (default: keep 30 days)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="close_circle_${TIMESTAMP}.duckdb"
KEEP_DAYS=30
LOG_PREFIX="[backup $(date '+%Y-%m-%d %H:%M:%S')]"

# Parse --keep-days argument
while [[ $# -gt 0 ]]; do
  case "$1" in
    --keep-days) KEEP_DAYS="$2"; shift 2 ;;
    *) echo "Unknown argument: $1"; exit 1 ;;
  esac
done

mkdir -p "$BACKUP_DIR"

echo "$LOG_PREFIX Starting backup → $BACKUP_DIR/$BACKUP_FILE"

# Stop the API so DuckDB flushes and releases the WAL cleanly
echo "$LOG_PREFIX Stopping API container..."
docker compose -f "$SCRIPT_DIR/docker-compose.yml" stop api

# Copy the DB file from the named volume using a temporary Alpine container
echo "$LOG_PREFIX Copying database..."
docker run --rm \
  -v close-circle-v2_duckdb_data:/data:ro \
  -v "$BACKUP_DIR:/backup" \
  alpine \
  cp /data/close_circle.duckdb "/backup/$BACKUP_FILE"

# Restart the API
echo "$LOG_PREFIX Restarting API container..."
docker compose -f "$SCRIPT_DIR/docker-compose.yml" start api

# Verify the backup looks sane (non-zero size)
BACKUP_SIZE=$(docker run --rm -v "$BACKUP_DIR:/backup" alpine stat -c%s "/backup/$BACKUP_FILE" 2>/dev/null || echo 0)
if [[ "$BACKUP_SIZE" -lt 1000 ]]; then
  echo "$LOG_PREFIX ERROR: backup file is suspiciously small (${BACKUP_SIZE} bytes)" >&2
  exit 1
fi

echo "$LOG_PREFIX Backup complete: $BACKUP_FILE ($(numfmt --to=iec "$BACKUP_SIZE" 2>/dev/null || echo "${BACKUP_SIZE} bytes"))"

# Prune backups older than KEEP_DAYS
PRUNED=$(find "$BACKUP_DIR" -name "close_circle_*.duckdb" -mtime +"$KEEP_DAYS" -print -delete | wc -l)
if [[ "$PRUNED" -gt 0 ]]; then
  echo "$LOG_PREFIX Pruned $PRUNED backup(s) older than ${KEEP_DAYS} days"
fi

# List current backups
echo "$LOG_PREFIX Current backups:"
ls -lh "$BACKUP_DIR"/close_circle_*.duckdb 2>/dev/null | awk '{print "  " $5 "  " $9}' || echo "  (none)"
