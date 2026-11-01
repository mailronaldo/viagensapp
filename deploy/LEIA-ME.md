# Deploy no AlmaLinux 10 (instalação direta com Apache)

> **Servidor com Coolify/Docker nas portas 80 e 443? Use o `COOLIFY.md`.** Este guia é para servidores
> sem proxy na frente; o `install.sh` recusa rodar se as portas estiverem ocupadas.

Instala Apache (proxy reverso), PostgreSQL, Node.js e o app como serviço systemd, com backup diário.

## 1. Enviar o pacote para o servidor

No seu PC (com a VPN conectada), na pasta onde está o arquivo `viagens-app-deploy.tar.gz`:

```bash
scp viagens-app-deploy.tar.gz SEU_USUARIO@IP_DO_SERVIDOR:/tmp/
ssh SEU_USUARIO@IP_DO_SERVIDOR
```

## 2. Instalar

No servidor:

```bash
sudo -i                       # ou use sudo antes de cada comando
cd /tmp && tar xzf viagens-app-deploy.tar.gz && cd viagens-app
DOMAIN=ronaldof.apps.hospedagem2k.com bash deploy/install.sh
```

O script mostra cada etapa e termina com "Pronto!". O build leva alguns minutos.
Ao final o app responde em `http://ronaldof.apps.hospedagem2k.com/`.

## 3. Ativar HTTPS

Confirme que o DNS do subdomínio aponta para o IP público deste servidor e que as portas
80 e 443 chegam até ele pela internet. Depois:

```bash
DOMAIN=ronaldof.apps.hospedagem2k.com bash deploy/enable-https.sh seu@email.com
```

Enquanto o HTTPS não estiver ativo, o cookie de sessão fica em modo "não seguro" para o login
funcionar em HTTP. Não use contas reais nesse período. O script de HTTPS troca para o modo seguro.

## Atualizar para uma versão nova

Envie o novo `.tar.gz`, extraia e rode o mesmo `deploy/install.sh`. Ele preserva banco, senhas e
arquivos enviados, recompila e aplica as migrações novas.

## Dia a dia

```bash
systemctl status viagens           # estado do app
journalctl -u viagens -f           # logs do app
tail -f /var/log/httpd/viagens_error.log
systemctl restart viagens
```

- Configuração secreta: `/opt/viagens/.env` (somente o usuário `viagens` lê).
- Arquivos enviados: `/var/lib/viagens/uploads`.
- Backups: `/var/backups/viagens` (banco + uploads, 14 dias). **Estão no mesmo disco do servidor**, então
  copie periodicamente para outro lugar. Para rodar um backup agora: `systemctl start viagens-backup`.
- Restaurar o banco: `runuser -u postgres -- pg_restore --clean --if-exists -d viagens /var/backups/viagens/db-DATA.dump`

## Se algo falhar

- **502 / "Service Unavailable" no navegador**: quase sempre SELinux. Rode `ausearch -m avc -ts recent`
  e confira `getsebool httpd_can_network_connect` (deve ser `on`).
- **Não abre de fora**: firewall do servidor ou do provedor. Portas 80 e 443 precisam estar liberadas.
- **Login não "pega" (volta para a tela de login)**: cookie seguro sem HTTPS. Ou ative o HTTPS, ou
  deixe `COOKIE_SECURE=false` em `/opt/viagens/.env` e reinicie o serviço.
- **Certbot falha**: o DNS ainda não aponta para o servidor, ou a porta 80 está bloqueada.
