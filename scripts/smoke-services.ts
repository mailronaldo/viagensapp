/**
 * Teste de integração da camada de serviços e do isolamento multiusuário,
 * direto no Postgres local. Rodar com:
 *   npm run test:services
 */
import assert from "node:assert/strict";
import { eq } from "drizzle-orm";
import { db, t } from "../src/db";
import { getTripAccessFor } from "../src/lib/access";
import { getAgenda } from "../src/services/agenda";
import { addExpense, getExpenseSummary } from "../src/services/expenses";
import { addDocument, getDocument, removeDocument } from "../src/services/documents";
import { parseDecimal } from "../src/lib/form";

async function main() {
  const stamp = Date.now();
  const mkUser = async (n: string) =>
    (
      await db
        .insert(t.users)
        .values({ name: n, email: `${n}-${stamp}@teste.dev`, passwordHash: "x" })
        .returning()
    )[0];

  const alice = await mkUser("alice");
  const bob = await mkUser("bob");

  const [trip] = await db
    .insert(t.trips)
    .values({
      ownerId: alice.id,
      title: "Teste Lisboa",
      destination: "Lisboa",
      startDate: "2026-11-10",
      endDate: "2026-11-15",
      timezone: "Europe/Lisbon",
      baseCurrency: "BRL",
    })
    .returning();
  await db.insert(t.tripMembers).values({ tripId: trip.id, userId: alice.id, role: "OWNER" });

  try {
    // --- Isolamento: Bob não enxerga a viagem da Alice
    assert.ok(await getTripAccessFor(alice.id, trip.id), "dono deve ter acesso");
    assert.equal(await getTripAccessFor(bob.id, trip.id), null, "outro usuário NÃO deve ter acesso");

    // --- Agenda: ordena por horário, itens sem horário por último, inclui reservas do dia
    await db.insert(t.itineraryItems).values([
      { tripId: trip.id, date: "2026-11-10", title: "Jantar", startTime: "20:00", type: "MEAL" },
      { tripId: trip.id, date: "2026-11-10", title: "Torre de Belém", startTime: "10:30" },
      { tripId: trip.id, date: "2026-11-10", title: "Passear sem pressa" },
      { tripId: trip.id, date: "2026-11-11", title: "Outro dia" },
    ]);
    await db.insert(t.bookings).values({
      tripId: trip.id,
      type: "FLIGHT",
      title: "Voo GRU→LIS",
      originAt: "2026-11-10 07:15:00",
      confirmationCode: "ABC123",
    });
    const agenda = await getAgenda(trip, "2026-11-10");
    assert.deepEqual(
      agenda.entries.map((e) => e.title),
      ["Voo GRU→LIS", "Torre de Belém", "Jantar", "Passear sem pressa"],
    );
    assert.equal(agenda.entries[0].kind, "booking");
    assert.equal(agenda.entries[0].time, "07:15");
    assert.equal((await getAgenda(trip, "2026-11-12")).entries.length, 0);

    // --- Custos: totais por moeda e conversão
    await addExpense(trip.id, alice.id, {
      date: "2026-11-10", category: "FOOD", description: "Almoço",
      amount: "20.00", currency: "EUR", exchangeRate: "6.000000",
    }, "whatsapp");
    await addExpense(trip.id, alice.id, {
      date: "2026-11-10", category: "TRANSPORT", description: "Táxi",
      amount: "50.00", currency: "BRL",
    });
    await addExpense(trip.id, alice.id, {
      date: "2026-11-11", category: "SHOPPING", description: "Lembrança sem cotação",
      amount: "10.00", currency: "USD",
    });
    const s = await getExpenseSummary(trip.id, "BRL");
    assert.equal(s.totalBase, 170); // 20*6 + 50
    assert.equal(s.unconvertedCount, 1);
    assert.equal(s.byCurrency.length, 3);
    assert.equal(s.byCategory[0].category, "FOOD");
    const [wa] = await db.select().from(t.expenses).where(eq(t.expenses.description, "Almoço"));
    assert.equal(wa.source, "whatsapp");

    // --- Documentos: upload válido, tipo inválido e remoção
    const pdf = new File([new Uint8Array([37, 80, 68, 70])], "passaporte.pdf", { type: "application/pdf" });
    const doc = await addDocument(trip.id, pdf, { type: "PASSPORT" });
    assert.equal(doc.title, "passaporte.pdf");
    assert.ok(await getDocument(trip.id, doc.id));
    assert.equal(await getDocument("outra-viagem", doc.id), null, "documento só é achado dentro da própria viagem");
    await assert.rejects(
      addDocument(trip.id, new File(["x"], "virus.exe", { type: "application/x-msdownload" }), { type: "OTHER" }),
      /Formato não suportado/,
    );
    await removeDocument(trip.id, doc.id);
    assert.equal(await getDocument(trip.id, doc.id), null);

    // --- Parser de valores pt-BR
    assert.equal(parseDecimal("1.234,56"), "1234.56");
    assert.equal(parseDecimal("12,5"), "12.50");
    assert.equal(parseDecimal("abc"), null);
    assert.equal(parseDecimal("0", { positive: true }), null);

    console.log("OK — todos os testes de serviços passaram.");
  } finally {
    await db.delete(t.trips).where(eq(t.trips.id, trip.id));
    await db.delete(t.users).where(eq(t.users.id, alice.id));
    await db.delete(t.users).where(eq(t.users.id, bob.id));
    process.exit(0);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
