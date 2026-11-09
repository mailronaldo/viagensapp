-- Categoria de custo reservada pro sistema: todo ingresso usa esta categoria
-- automaticamente, e ela não pode ser excluída no gestor da agência.
INSERT INTO "expense_categories" ("id", "name") VALUES ('INGRESSOS', 'Ingressos')
ON CONFLICT ("name") DO NOTHING;
