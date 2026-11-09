-- Categoria de custo reservada pro sistema: todo chip/eSIM usa esta categoria
-- automaticamente, e ela não pode ser excluída no gestor da agência. As
-- categorias de transporte, hospedagem e seguro já existiam (seed inicial).
INSERT INTO "expense_categories" ("id", "name") VALUES ('TELEFONIA', 'Telefonia')
ON CONFLICT ("name") DO NOTHING;
