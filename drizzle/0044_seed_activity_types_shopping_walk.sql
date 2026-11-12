-- Dois tipos de atividade novos pedidos pra rotas no Google Maps: Compras
-- (pode ter várias dicas/lojas, vira roteiro com paradas) e Caminhada
-- (pede rota a pé por padrão).
INSERT INTO "activity_types" ("id", "name") VALUES
    ('SHOPPING', 'Compras'),
    ('WALK', 'Caminhada')
ON CONFLICT ("id") DO NOTHING;
