# Publicar no Coolify

O servidor já roda o Coolify (Traefik nas portas 80/443). Ele constrói o app a partir de um
repositório Git, cuida do domínio e do certificado HTTPS e guarda o banco e os arquivos em volumes.
**Não use o `install.sh` neste servidor**: ele tentaria instalar o Apache nas mesmas portas.

O que a plataforma precisa já está no projeto: `Dockerfile`, `docker-entrypoint.sh` (ajusta a
permissão do volume e aplica as migrações do banco a cada início) e `scripts/migrate.mjs`.

## 1. Colocar o código em um repositório Git

O Coolify lê o código de um repositório. Crie um repositório **privado** e vazio no GitHub
(ou GitLab/Gitea) e, no seu PC:

```bash
tar xzf viagens-app-deploy.tar.gz && cd viagens-app
git init -b main
git add . && git commit -m "Minhas Viagens"
git remote add origin git@github.com:SEU_USUARIO/minhas-viagens.git
git push -u origin main
```

O `.gitignore` já impede que `.env`, `uploads/` e `node_modules/` sejam enviados.

## 2. Criar o banco PostgreSQL

No painel do Coolify: **Projects → (seu projeto) → + New → Database → PostgreSQL** (versão 16 ou 17).
Inicie o banco e copie a **Postgres URL (internal)**. Ela tem o formato
`postgres://usuario:senha@nome-interno:5432/postgres` e só funciona dentro da rede do Coolify.

## 3. Criar a aplicação

**+ New → Application** e escolha a origem do repositório:
- *Private Repository (with Deploy Key)*: o Coolify mostra uma chave pública; cadastre-a no GitHub em
  **Settings → Deploy keys** do repositório (somente leitura).
- Ou *Private Repository (with GitHub App)* se você já conectou o GitHub ao Coolify.

Depois configure:

| Campo | Valor |
|---|---|
| Build Pack | **Dockerfile** |
| Branch | `main` |
| Ports Exposes | `3000` |
| Domains | `https://ronaldof.apps.hospedagem2k.com` |

### Variáveis de ambiente (aba Environment Variables)

| Nome | Valor |
|---|---|
| `DATABASE_URL` | a Postgres URL (internal) do passo 2 |
| `AUTH_SECRET` | um segredo longo: `openssl rand -hex 32` |

Não defina `COOKIE_SECURE`: em produção o cookie já é seguro, e o domínio terá HTTPS.

### Armazenamento persistente (aba Persistent Storage)

Adicione um **Volume Mount** com destino `/data/uploads`. Sem isso, notas, vouchers e passaportes
enviados somem a cada novo deploy.

## 4. Publicar

Clique em **Deploy**. O Coolify constrói a imagem, sobe o contêiner (que aplica as migrações
sozinho) e o Traefik emite o certificado Let's Encrypt para o domínio. O DNS de
`ronaldof.apps.hospedagem2k.com` já aponta para este servidor.

Abra `https://ronaldof.apps.hospedagem2k.com`, entre com o `MASTER_EMAIL` / `MASTER_PASSWORD` definidos nas variáveis (não existe cadastro público), crie um cliente em *Clientes → Novo cliente* e teste com ele.
Os logs do build e do app aparecem no próprio painel.

## Atualizar

Faça `git push` com as mudanças e clique em **Deploy** (ou ative o deploy automático por webhook).
Banco e arquivos enviados são preservados; migrações novas são aplicadas no início.

## Backups

- **Banco**: no recurso PostgreSQL, aba **Backups**, agende um backup (diário). Configure um destino S3 se
  puder, para a cópia não ficar só neste servidor.
- **Arquivos enviados**: o volume `/data/uploads` **não** entra no backup do banco. Copie-o de vez em
  quando (por exemplo com `docker run --rm -v NOME_DO_VOLUME:/d -v $PWD:/b alpine tar czf /b/uploads.tgz -C /d .`;
  o nome do volume aparece na aba Persistent Storage).

## Se algo falhar

- **Build falhou**: veja o log do deploy no Coolify; me mande o trecho final.
- **Contêiner reinicia sem parar**: quase sempre `DATABASE_URL` errada ou banco ainda não iniciado.
  O log mostra "Aguardando o banco de dados…" ou a mensagem de erro da migração.
- **502 / "no available server"**: confira se *Ports Exposes* é `3000` e se o contêiner está *healthy*.
- **Login volta para a tela de login**: o acesso precisa ser por `https://` (cookie seguro).

## Sobras da tentativa anterior (opcional)

A instalação direta deixou no servidor: Postgres do sistema, Node, Apache (desativado), certbot, a pasta
`/opt/viagens` e o usuário `viagens`. Nada disso atrapalha o Coolify. Se você não usava Postgres no servidor
antes, pode liberar recursos com `systemctl disable --now postgresql`. Não remova nada que você já usava.


## Variáveis da agência (MASTER)

Adicione em *Environment Variables* (Runtime): `MASTER_EMAIL`, `MASTER_PASSWORD` (mín. 8 caracteres) e, se quiser, `MASTER_NAME`. Elas só têm efeito se ainda não existir MASTER; se o e-mail já existir como usuário, ele é promovido a MASTER sem trocar a senha. Depois do primeiro acesso, **apague `MASTER_PASSWORD`** e faça Redeploy.

## Arquivos somem após o redeploy?

O volume precisa estar em *Persistent Storage* com destino `/data/uploads`. Confira no servidor:
`sudo docker inspect $(sudo docker ps -q --filter "name=<id-da-aplicação>") --format '{{json .Mounts}}'` — deve listar um volume com `Destination":"/data/uploads"`. Sem isso o arquivo é apagado a cada deploy (a tela passa a mostrar "O arquivo não foi encontrado" em vez de erro 500) e é preciso reenviá-lo.
