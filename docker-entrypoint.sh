#!/bin/sh
# Roda como root só para acertar a permissão do volume (que o Docker cria como root),
# e então passa para o usuário "node" para migrar o banco, criar a conta master (se for
# a primeira vez) e iniciar o app.
set -e

: "${UPLOAD_DIR:=/data/uploads}"
mkdir -p "$UPLOAD_DIR"
chown -R node:node "$UPLOAD_DIR" 2>/dev/null || true

exec su node -s /bin/sh -c '
  node scripts/migrate.mjs &&
  node scripts/seed-master.mjs &&
  exec node node_modules/next/dist/bin/next start -H 0.0.0.0 -p "${PORT:-3000}"
'
