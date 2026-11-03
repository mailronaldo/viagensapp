# Minhas Viagens

Gestão de viagens de turismo: cadastro da viagem, roteiro dia a dia, reservas (voos, hotéis…), central de custos com recibos e central de documentos. Multiusuário com papéis. Versão 1 apenas web; a arquitetura já foi pensada para receber o WhatsApp depois.

## Rodando localmente

Requisitos: Node 22+, PostgreSQL 16.

```bash
cp .env.example .env        # ajuste DATABASE_URL e AUTH_SECRET
npm install
npm run db:migrate          # cria as tabelas
npm run dev                 # http://localhost:3000
```

Variáveis (`.env`):

| Variável | Para quê |
|---|---|
| `DATABASE_URL` | conexão Postgres |
| `AUTH_SECRET` | segredo da sessão (`openssl rand -hex 32`) |
| `UPLOAD_DIR` | pasta dos arquivos enviados (padrão `./uploads`) |
| `COOKIE_SECURE` | `false` só para rodar em HTTP puro; em produção use HTTPS |

Testes: `npm run test:services` (serviços + isolamento, direto no banco) e, com o servidor no ar, `python3 scripts/e2e_roles.py` (fluxo completo por HTTP, 106 verificações; precisa de `BASE`, `MASTER_EMAIL` e `MASTER_PASSWORD`, num banco novo).

## Arquitetura

```
src/
  db/schema.ts        modelo de dados (Drizzle + Postgres)
  lib/access.ts       ÚNICO ponto de autorização: só membros enxergam a viagem
  lib/storage.ts      arquivos atrás de 3 funções (disco hoje; S3/R2 depois)
  services/           regras de negócio SEM Next/HTTP  ← o WhatsApp reaproveita
    agenda.ts         getAgenda(trip, data)
    expenses.ts       addExpense(..., source), getExpenseSummary
    documents.ts      addDocument, listDocuments, getDocument
  app/actions/        server actions (validação + chamam os services)
  app/(app)/trips/    telas: visão geral, roteiro, reservas, custos, documentos
  app/api/files/      download autenticado de documentos
```

Decisões que importam:

- **Multi-tenant**: toda leitura/escrita passa por `requireTripAccess`; quem não é membro recebe 404. Papéis `OWNER/EDITOR/VIEWER` já existem em `trip_members`.
- **Datas/horários** de roteiro e reservas são "relógio de parede" do destino (sem fuso embutido); "hoje" é calculado no fuso da viagem.
- **Custos** em qualquer moeda, com cotação opcional para a moeda base; lançamentos sem cotação ficam fora do total convertido e o app avisa.
- `expenses.source` já distingue `web` de `whatsapp`; `users.whatsappPhone` (E.164) já está no schema.

## Plano para o WhatsApp (próxima fase)

1. Rota `POST /api/whatsapp/webhook` (WhatsApp Cloud API da Meta) com verificação de assinatura.
2. Vincular número: o usuário informa o telefone no perfil e confirma por código enviado no WhatsApp → grava `whatsappPhone`. Mensagens de números não vinculados são ignoradas.
3. Viagem ativa: a do usuário em andamento hoje (ou a escolhida por comando).
4. Comandos mapeados para os services que já existem:
   - "agenda" / "agenda amanhã" → `getAgenda`
   - foto de nota → extrair valor/data/descrição (visão computacional via API do Claude) → confirmar com o usuário → `addExpense(..., "whatsapp")` + `addDocument` como recibo
   - "recibos" / "reserva do hotel" → `listDocuments` / `getDocument` e envio do arquivo
5. Fase seguinte: localização compartilhada → dicas próximas (usa `latitude/longitude` já presentes nos itens do roteiro).

Pontos de atenção da Meta: conta business verificada, número dedicado, janela de 24 h para respostas livres e templates aprovados para mensagens proativas.

## O que ainda não existe (v1)

- Convite de acompanhantes (o modelo suporta; falta a tela e o fluxo de convite).
- Edição de itens já criados (hoje: adicionar e remover).
- Limite de tentativas de login, recuperação de senha e verificação de e-mail.
- Storage em nuvem e backups — hoje os arquivos ficam em disco local.
- Mapa/GPS e integração com WhatsApp.

## Papéis

- **MASTER (agência)**: dono do sistema. Painel em `/agency`; cria clientes (gera senha temporária, mostrada uma única vez), edita, redefine senha, desativa/reativa e pode "Acessar área do cliente" (banner âmbar + "Voltar à agência").
- **CLIENT**: tem seu painel de viagens e cadastra **viajantes** (`/travelers`), que podem ser incluídos no grupo de cada viagem. No primeiro acesso troca a senha temporária.
- Não há cadastro público. A primeira conta MASTER nasce no start a partir de `MASTER_EMAIL`, `MASTER_PASSWORD` e `MASTER_NAME`; depois remova `MASTER_PASSWORD`.
- Login/permissões dos viajantes dentro da viagem ficam para uma próxima versão.

## Edição
Atividades (`/trips/:id/itinerary/items/:itemId`), reservas (`/bookings/:bookingId`) e custos (`/expenses/:expenseId`) podem ser editados e excluídos. Em cada um é possível manter, substituir ou remover o anexo (ingresso, voucher, recibo); o arquivo antigo continua na Central de documentos.

## Roteiro
- `/trips/:id/itinerary` — **roteiro resumido**: cidades da viagem e uma linha por dia (título, descrição breve, cidades e nº de atividades).
- `/trips/:id/itinerary/day/AAAA-MM-DD` — **dia a dia**: resumo do dia (editável), agenda com horários e cadastro de atividades; navegação entre dias.
- `/trips/:id/edit` — **editar viagem** (só o dono). Não permite mover/encurtar o período deixando atividades, resumos de dia ou cidades fora das novas datas, nem trocar a moeda base com custos lançados.
