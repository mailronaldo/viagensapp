#!/usr/bin/env bash
# Instala (ou atualiza) o Minhas Viagens em AlmaLinux 10.
# Idempotente: pode rodar de novo a cada nova versão do código.
#
#   sudo DOMAIN=ronaldof.apps.hospedagem2k.com bash deploy/install.sh
#
# Rode a partir da pasta do projeto extraída (a que contém package.json).
set -euo pipefail

DOMAIN="${DOMAIN:-ronaldof.apps.hospedagem2k.com}"
APP_USER="viagens"
APP_DIR="/opt/viagens"
DATA_DIR="/var/lib/viagens"
BACKUP_DIR="/var/backups/viagens"
APP_PORT="3000"
DB_NAME="viagens"
DB_USER="viagens"

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

log()  { printf '\n\033[1;32m==> %s\033[0m\n' "$*"; }
warn() { printf '\033[1;33mAVISO: %s\033[0m\n' "$*"; }
die()  { printf '\033[1;31mERRO: %s\033[0m\n' "$*" >&2; exit 1; }

# mod_ssl exige um certificado provisório (/etc/pki/tls/.../localhost.*). Normalmente o
# httpd-init o cria, mas garantimos aqui para o Apache nunca falhar ao ler o ssl.conf.
ensure_placeholder_cert() {
  local crt=/etc/pki/tls/certs/localhost.crt key=/etc/pki/tls/private/localhost.key
  if [ ! -s "$crt" ] || [ ! -s "$key" ]; then
    echo "Gerando certificado provisório do mod_ssl"
    openssl req -x509 -nodes -newkey rsa:2048 -days 3650 -subj "/CN=localhost" \
      -keyout "$key" -out "$crt" 2>/dev/null
    chmod 600 "$key"; chmod 644 "$crt"
    command -v restorecon >/dev/null && restorecon "$crt" "$key" || true
  fi
}

[ "$(id -u)" -eq 0 ] || die "Rode como root (sudo)."
[ -f "$SRC_DIR/package.json" ] || die "package.json não encontrado em $SRC_DIR."
[ -f /etc/almalinux-release ] || warn "Não parece AlmaLinux; o script foi escrito para AlmaLinux/RHEL 10."

# >>> trava de portas
# Se 80/443 já pertencem a outro serviço (Docker/Coolify/nginx), o Apache não sobe e o
# certbot não valida o domínio. Melhor parar aqui do que deixar o servidor pela metade.
# Testa conectando nas portas (não depende de ss/netstat). Em reinstalação, se o nosso
# próprio Apache já está ativo, as portas são dele e a checagem é dispensada.
CHECK_PORTS="${CHECK_PORTS:-80 443}"
check_ports_free() {
  local p busy=""
  systemctl is-active --quiet httpd 2>/dev/null && return 0
  for p in $CHECK_PORTS; do
    if (exec 3<>"/dev/tcp/127.0.0.1/$p") 2>/dev/null; then busy="$busy $p"; fi
  done
  if [ -n "$busy" ]; then
    command -v ss >/dev/null && ss -ltnp 2>/dev/null | grep -E ":($(echo $CHECK_PORTS | tr ' ' '|'))\b" >&2 || true
    die "Porta(s)${busy} já em uso por outro serviço. Se for Docker/Coolify, publique o app por ele: leia deploy/COOLIFY.md. Para ignorar esta trava: SKIP_PORT_CHECK=1."
  fi
}
[ "${SKIP_PORT_CHECK:-0}" = "1" ] || check_ports_free
# <<< trava de portas

# ---------------------------------------------------------------- pacotes
log "Instalando pacotes (httpd, PostgreSQL, Node.js, utilitários)"
dnf -y install httpd mod_ssl postgresql-server postgresql nodejs npm \
  rsync tar curl policycoreutils

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 20 ]; then
  die "Node.js $(node -v) é antigo demais (o Next.js 16 pede 20.9+; recomendado 22). Instale o Node 22 e rode de novo."
fi
echo "Node $(node -v), PostgreSQL $(postgres --version 2>/dev/null || echo '?')"

# ---------------------------------------------------------------- Postgres
log "Configurando PostgreSQL"
if [ ! -f /var/lib/pgsql/data/PG_VERSION ]; then
  postgresql-setup --initdb
fi
systemctl enable --now postgresql

# Segredos: reaproveita os existentes para não quebrar a instalação em updates.
ENV_FILE="$APP_DIR/.env"
if [ -f "$ENV_FILE" ]; then
  DB_PASS="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | sed -E 's#.*://[^:]+:([^@]+)@.*#\1#' || true)"
  AUTH_SECRET="$(grep -E '^AUTH_SECRET=' "$ENV_FILE" | cut -d'"' -f2 || true)"
  COOKIE_SECURE_VALUE="$(grep -E '^COOKIE_SECURE=' "$ENV_FILE" | cut -d= -f2 || true)"
fi
DB_PASS="${DB_PASS:-$(openssl rand -hex 24)}"
AUTH_SECRET="${AUTH_SECRET:-$(openssl rand -hex 32)}"
COOKIE_SECURE_VALUE="${COOKIE_SECURE_VALUE:-false}"   # vira "true" em enable-https.sh

PSQL=(runuser -u postgres -- psql -v ON_ERROR_STOP=1 -X -q)
"${PSQL[@]}" <<SQL
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '${DB_USER}') THEN
    CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}';
  ELSE
    ALTER ROLE ${DB_USER} PASSWORD '${DB_PASS}';
  END IF;
END
\$\$;
SQL
if ! "${PSQL[@]}" -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1; then
  "${PSQL[@]}" -c "CREATE DATABASE ${DB_NAME} OWNER ${DB_USER}"
fi

# ---------------------------------------------------------------- usuário e pastas
log "Preparando usuário e pastas"
id "$APP_USER" >/dev/null 2>&1 || \
  useradd --system --home-dir "$APP_DIR" --shell /sbin/nologin "$APP_USER"
mkdir -p "$APP_DIR" "$DATA_DIR/uploads" "$BACKUP_DIR"
chown -R "$APP_USER:$APP_USER" "$DATA_DIR"
chmod 750 "$DATA_DIR"
chmod 700 "$BACKUP_DIR"

# ---------------------------------------------------------------- código
log "Copiando o código para $APP_DIR"
systemctl stop viagens 2>/dev/null || true   # evita rodar enquanto o build troca arquivos
rsync -a --delete \
  --exclude node_modules --exclude .next --exclude .git \
  --exclude uploads --exclude '.env' --exclude '.env.*' \
  "$SRC_DIR"/ "$APP_DIR"/

umask 077
cat > "$ENV_FILE" <<ENV
DATABASE_URL="postgresql://${DB_USER}:${DB_PASS}@127.0.0.1:5432/${DB_NAME}"
AUTH_SECRET="${AUTH_SECRET}"
UPLOAD_DIR="${DATA_DIR}/uploads"
COOKIE_SECURE=${COOKIE_SECURE_VALUE}
ENV
umask 022
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
chmod 600 "$ENV_FILE"

# ---------------------------------------------------------------- build + migrações
log "Instalando dependências e compilando (leva alguns minutos)"
as_app() { runuser -u "$APP_USER" -- env HOME="$APP_DIR" bash -c "cd '$APP_DIR' && $*"; }
as_app "npm ci --no-audit --no-fund"
as_app "npm run build"

log "Aplicando migrações do banco"
as_app "set -a && . ./.env && set +a && npx drizzle-kit migrate"

# ---------------------------------------------------------------- serviço do app
log "Criando o serviço systemd"
cat > /etc/systemd/system/viagens.service <<UNIT
[Unit]
Description=Minhas Viagens (Next.js)
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=${APP_USER}
Group=${APP_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${ENV_FILE}
Environment=NODE_ENV=production
ExecStart=/usr/bin/node ${APP_DIR}/node_modules/next/dist/bin/next start -H 127.0.0.1 -p ${APP_PORT}
Restart=on-failure
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full
ProtectHome=true

[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable viagens
systemctl restart viagens

# ---------------------------------------------------------------- Apache
log "Configurando o Apache como proxy reverso"
cat > /etc/httpd/conf.d/viagens.conf <<APACHE
<VirtualHost *:80>
    ServerName ${DOMAIN}

    ProxyPreserveHost On
    RequestHeader set X-Forwarded-Proto expr=%{REQUEST_SCHEME}
    ProxyPass / http://127.0.0.1:${APP_PORT}/
    ProxyPassReverse / http://127.0.0.1:${APP_PORT}/

    # Uploads de até 15 MB (o app limita a 10 MB por arquivo)
    LimitRequestBody 15728640

    ErrorLog logs/viagens_error.log
    CustomLog logs/viagens_access.log combined
</VirtualHost>
APACHE
ensure_placeholder_cert
httpd -t
# SELinux: sem isto o Apache não consegue falar com o app na porta ${APP_PORT}
if command -v setsebool >/dev/null && [ "$(getenforce 2>/dev/null)" != "Disabled" ]; then
  setsebool -P httpd_can_network_connect 1
fi
systemctl enable --now httpd
systemctl reload httpd

# ---------------------------------------------------------------- firewall
# Só mexe se o firewalld já estiver ativo, para nunca cortar seu acesso SSH/VPN.
if systemctl is-active --quiet firewalld; then
  log "Liberando HTTP e HTTPS no firewalld"
  firewall-cmd --permanent --add-service=http --add-service=https >/dev/null
  firewall-cmd --reload >/dev/null
else
  warn "firewalld não está ativo; não alterei regras de firewall. Garanta que as portas 80 e 443 estão abertas."
fi

# ---------------------------------------------------------------- backup diário
log "Agendando backup diário (03:30)"
install -m 750 "$SRC_DIR/deploy/backup.sh" /usr/local/sbin/viagens-backup
cat > /etc/systemd/system/viagens-backup.service <<UNIT
[Unit]
Description=Backup do Minhas Viagens

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/viagens-backup
UNIT
cat > /etc/systemd/system/viagens-backup.timer <<UNIT
[Unit]
Description=Backup diário do Minhas Viagens

[Timer]
OnCalendar=*-*-* 03:30:00
Persistent=true

[Install]
WantedBy=timers.target
UNIT
systemctl daemon-reload
systemctl enable --now viagens-backup.timer

# ---------------------------------------------------------------- verificação
log "Verificando se o app respondeu"
for i in $(seq 1 20); do
  code="$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:${APP_PORT}/login" || true)"
  [ "$code" = "200" ] && break
  sleep 1
done
[ "$code" = "200" ] || { journalctl -u viagens -n 40 --no-pager; die "O app não respondeu em 127.0.0.1:${APP_PORT} (último código: ${code:-nenhum})."; }

code="$(curl -s -o /dev/null -w '%{http_code}' -H "Host: ${DOMAIN}" http://127.0.0.1/login || true)"
[ "$code" = "200" ] || { tail -n 20 /var/log/httpd/viagens_error.log 2>/dev/null || true; die "O Apache não repassou ao app (código: ${code:-nenhum}). Veja se o SELinux bloqueou: ausearch -m avc -ts recent"; }

log "Pronto!"
echo "App no ar em http://${DOMAIN}/ (HTTP por enquanto)."
echo "Próximo passo: aponte o DNS de ${DOMAIN} para este servidor e rode:"
echo "  sudo DOMAIN=${DOMAIN} bash deploy/enable-https.sh seu@email.com"
