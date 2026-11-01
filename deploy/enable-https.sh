#!/usr/bin/env bash
# Ativa HTTPS (Let's Encrypt) no Apache e passa o cookie de sessão para "seguro".
#
#   sudo DOMAIN=ronaldof.apps.hospedagem2k.com bash deploy/enable-https.sh seu@email.com
#
# Pré-requisitos: o DNS de DOMAIN já aponta para este servidor e as portas
# 80 e 443 estão acessíveis pela internet (a validação do certificado usa a 80).
set -euo pipefail

DOMAIN="${DOMAIN:-ronaldof.apps.hospedagem2k.com}"
EMAIL="${1:-}"
ENV_FILE="/opt/viagens/.env"

die() { printf '\033[1;31mERRO: %s\033[0m\n' "$*" >&2; exit 1; }

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
[ -n "$EMAIL" ] || die "Informe um e-mail: bash deploy/enable-https.sh seu@email.com"
[ -f "$ENV_FILE" ] || die "Rode primeiro o deploy/install.sh."

echo "==> Instalando o certbot"
dnf -y install epel-release
dnf -y install certbot python3-certbot-apache

ensure_placeholder_cert
httpd -t || die "A configuração do Apache tem erro; corrija antes de emitir o certificado."
systemctl start httpd

echo "==> Emitindo o certificado para ${DOMAIN}"
certbot --apache -d "$DOMAIN" -m "$EMAIL" --agree-tos --no-eff-email --redirect -n

echo "==> Marcando o cookie de sessão como seguro"
if grep -q '^COOKIE_SECURE=' "$ENV_FILE"; then
  sed -i 's/^COOKIE_SECURE=.*/COOKIE_SECURE=true/' "$ENV_FILE"
else
  echo 'COOKIE_SECURE=true' >> "$ENV_FILE"
fi
systemctl restart viagens

echo "==> Renovação automática"
systemctl enable --now certbot-renew.timer 2>/dev/null || \
  echo "(timer do certbot não encontrado; confira 'systemctl list-timers | grep certbot')"

echo
echo "Pronto: https://${DOMAIN}/"
