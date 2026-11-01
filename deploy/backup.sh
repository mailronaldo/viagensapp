#!/usr/bin/env bash
# Backup do banco e dos arquivos enviados. Instalado em /usr/local/sbin/viagens-backup
# e executado todo dia pelo timer viagens-backup.timer. Guarda os últimos 14 dias.
set -euo pipefail

BACKUP_DIR="/var/backups/viagens"
UPLOADS_DIR="/var/lib/viagens/uploads"
KEEP_DAYS=14
STAMP="$(date +%F_%H%M)"

umask 077
mkdir -p "$BACKUP_DIR"

runuser -u postgres -- pg_dump --format=custom viagens > "$BACKUP_DIR/db-$STAMP.dump"
tar -czf "$BACKUP_DIR/uploads-$STAMP.tar.gz" -C "$(dirname "$UPLOADS_DIR")" "$(basename "$UPLOADS_DIR")"

find "$BACKUP_DIR" -type f \( -name 'db-*.dump' -o -name 'uploads-*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete
echo "Backup concluído em $BACKUP_DIR ($STAMP)"
