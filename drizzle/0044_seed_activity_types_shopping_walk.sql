-- Dois tipos de atividade novos pedidos pra rotas no Google Maps: Compras
-- (pode ter várias dicas/lojas, vira roteiro com paradas) e Caminhada
-- (pede rota a pé por padrão).
-- ON CONFLICT em "name" (não "id"): "name" tem unique constraint própria e
-- esse cliente já tinha um tipo de atividade chamado "Compras" cadastrado
-- (com outro id) — o conflito real era nesse unique, não no de "id".
INSERT INTO "activity_types" ("id", "name") VALUES
    ('SHOPPING', 'Compras'),
    ('WALK', 'Caminhada')
ON CONFLICT ("name") DO NOTHING;
