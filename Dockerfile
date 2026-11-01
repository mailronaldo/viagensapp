# Imagem de produção do Minhas Viagens (usada pelo Coolify).
# Estágio 1: instala dependências e compila. Estágio 2: só o necessário para rodar.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-alpine
RUN apk add --no-cache su-exec
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000 \
    UPLOAD_DIR=/data/uploads

COPY --from=build /app ./
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh \
 && mkdir -p /data/uploads \
 && chown -R node:node /data /app/.next

# Arquivos enviados (notas, vouchers, passaportes) ficam aqui: monte um volume persistente.
VOLUME ["/data/uploads"]
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
  CMD wget -q -O /dev/null "http://127.0.0.1:${PORT}/login" || exit 1

ENTRYPOINT ["docker-entrypoint.sh"]
