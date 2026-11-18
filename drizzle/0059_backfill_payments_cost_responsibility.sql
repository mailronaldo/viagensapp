-- Preenche quem gerou o custo de cada pagamento já lançado, a partir da
-- origem (mesma convenção isGroup/travelerId de bookings/vouchers). Sem
-- origem própria (despesa, reserva/voucher da atividade, custo avulso):
-- vira custo do grupo, igual ao comportamento implícito de hoje.
UPDATE payments
SET cost_is_group = true
WHERE source_type IN ('EXPENSE', 'ITEM_RESERVATION', 'ITEM_EXPENSE');
--> statement-breakpoint

UPDATE payments p
SET cost_traveler_id = at.traveler_id
FROM activity_tickets at
WHERE p.source_type = 'ACTIVITY_TICKET' AND p.source_id = at.id;
--> statement-breakpoint

UPDATE payments p
SET cost_traveler_id = ps.traveler_id
FROM passes ps
WHERE p.source_type = 'PASS' AND p.source_id = ps.id;
--> statement-breakpoint

UPDATE payments p
SET cost_is_group = tv.is_group, cost_traveler_id = tv.traveler_id
FROM transport_vouchers tv
WHERE p.source_type = 'TRANSPORT_VOUCHER' AND p.source_id = tv.id;
--> statement-breakpoint

UPDATE payments p
SET cost_is_group = lv.is_group
FROM lodging_vouchers lv
WHERE p.source_type = 'LODGING_VOUCHER' AND p.source_id = lv.id;
--> statement-breakpoint

-- Voucher de hospedagem não-grupo com exatamente 1 viajante vinculado: usa
-- esse viajante (null = dono da viagem); com 0 ou 2+ (rateio ambíguo pra um
-- único campo), fica como custo do grupo via UPDATE acima.
UPDATE payments p
SET cost_traveler_id = single.traveler_id
FROM (
  SELECT voucher_id, min(traveler_id) AS traveler_id
  FROM lodging_voucher_travelers
  GROUP BY voucher_id
  HAVING count(*) = 1
) single
JOIN lodging_vouchers lv ON lv.id = single.voucher_id
WHERE p.source_type = 'LODGING_VOUCHER' AND p.source_id = lv.id AND lv.is_group = false;
--> statement-breakpoint

UPDATE payments p
SET cost_traveler_id = tins.traveler_id
FROM travel_insurances tins
WHERE p.source_type = 'TRAVEL_INSURANCE' AND p.source_id = tins.id;
