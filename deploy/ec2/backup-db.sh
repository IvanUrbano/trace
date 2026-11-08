#!/bin/bash
set -euo pipefail
set -a
. deploy/ec2/.env
set +a
BACKUP_DIR="/opt/trace/backups"
mkdir -p "$BACKUP_DIR"
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_FILE="$BACKUP_DIR/trace-db-$TIMESTAMP.sql"
sudo docker compose -f deploy/ec2/docker-compose.yml exec -T db pg_dumpall -U trace > "$BACKUP_FILE"
echo "Backup written to $BACKUP_FILE"
ls -t "$BACKUP_DIR"/trace-db-*.sql | tail -n +8 | xargs -r rm
EOF
