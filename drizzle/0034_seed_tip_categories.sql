-- Categoria de dica deixa de ser um enum fixo e vira um cadastro da agência
-- (tip_categories). Semeia as mesmas 7 categorias que já existiam como enum,
-- reaproveitando os mesmos ids (ex. "COMIDA"), pra manter compatível com
-- qualquer dica que já tenha sido salva com esses valores.
INSERT INTO "tip_categories" ("id", "name") VALUES
    ('COMIDA', 'Comida'),
    ('ARTE', 'Arte'),
    ('CULTURA', 'Cultura'),
    ('ATRACOES', 'Atrações'),
    ('LOJAS', 'Lojas'),
    ('CURIOSIDADES', 'Curiosidades'),
    ('OUTROS', 'Outros')
ON CONFLICT ("id") DO NOTHING;
