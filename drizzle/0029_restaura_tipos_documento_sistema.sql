-- Alguns tipos de documento (RECEIPT, RESERVATION, TICKET, OTHER) são usados
-- internamente pelo sistema (ícone de hospedagem, voucher, ingresso, reserva,
-- recibo de custo avulso) e precisam sempre existir. Se algum foi excluído
-- pelo cadastro (ficava "sem uso aparente" porque é usado só por baixo dos
-- panos), os uploads que dependem dele passam a falhar. Este INSERT restaura
-- os que faltarem, sem duplicar nem mexer nos que já existem.
INSERT INTO "document_types" ("id", "name") VALUES
	('PASSPORT', 'Passaporte'),
	('VISA', 'Visto'),
	('INSURANCE', 'Seguro viagem'),
	('TICKET', 'Ingresso'),
	('VOUCHER', 'Voucher'),
	('RECEIPT', 'Nota / recibo'),
	('RESERVATION', 'Reserva'),
	('OTHER', 'Outro')
ON CONFLICT ("id") DO NOTHING;
