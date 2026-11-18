-- Mescla o anexo "ingresso/voucher" da atividade (ticket_document_id,
-- removido em 0057) no Voucher/Reserva único da atividade — só quando a
-- reserva ainda não tem anexo próprio. Em conflito (os dois preenchidos,
-- diferentes), a reserva prevalece e o documento do ticket fica órfão (não
-- apagado) na Central de Documentos — revisar manualmente se necessário.
UPDATE "itinerary_items"
SET "reservation_document_id" = "ticket_document_id"
WHERE "ticket_document_id" IS NOT NULL
  AND "reservation_document_id" IS NULL;
