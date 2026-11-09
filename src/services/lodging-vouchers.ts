import "server-only";
import { asc, eq, inArray } from "drizzle-orm";
import { db, t } from "@/db";

/** Vouchers de uma hospedagem, com subcategoria e viajantes cobertos resolvidos. */
export async function listLodgingVouchers(lodgingId: string, ownerName: string) {
  const vouchers = await db
    .select({ voucher: t.lodgingVouchers, subcategoryName: t.lodgingTypeSubcategories.name })
    .from(t.lodgingVouchers)
    .leftJoin(t.lodgingTypeSubcategories, eq(t.lodgingTypeSubcategories.id, t.lodgingVouchers.subcategoryId))
    .where(eq(t.lodgingVouchers.lodgingId, lodgingId))
    .orderBy(asc(t.lodgingVouchers.createdAt));
  if (vouchers.length === 0) return [];

  const voucherIds = vouchers.map((v) => v.voucher.id);
  const travelerRows = await db
    .select({ voucherId: t.lodgingVoucherTravelers.voucherId, travelerId: t.lodgingVoucherTravelers.travelerId, travelerName: t.travelers.name })
    .from(t.lodgingVoucherTravelers)
    .leftJoin(t.travelers, eq(t.travelers.id, t.lodgingVoucherTravelers.travelerId))
    .where(inArray(t.lodgingVoucherTravelers.voucherId, voucherIds));
  const travelersByVoucher = new Map<string, { id: string | null; name: string }[]>();
  for (const r of travelerRows) {
    const list = travelersByVoucher.get(r.voucherId) ?? [];
    list.push({ id: r.travelerId, name: r.travelerId ? r.travelerName ?? "" : `${ownerName} (dono da viagem)` });
    travelersByVoucher.set(r.voucherId, list);
  }

  return vouchers.map((v) => {
    const travelers = travelersByVoucher.get(v.voucher.id) ?? [];
    return {
      ...v.voucher,
      subcategoryName: v.subcategoryName,
      travelerIds: travelers.map((tr) => tr.id ?? "owner"),
      scopeLabel: v.voucher.isGroup ? "Grupo" : travelers.map((tr) => tr.name).join(", ") || "Sem viajante selecionado",
    };
  });
}

/** Vouchers de várias hospedagens de uma vez (listagem), já resumidos. */
export async function listVouchersForLodgings(lodgingIds: string[]) {
  const byLodging = new Map<string, { scopeLabel: string; price: string | null; currency: string | null; status: string }[]>();
  if (lodgingIds.length === 0) return byLodging;

  const vouchers = await db
    .select({ voucher: t.lodgingVouchers })
    .from(t.lodgingVouchers)
    .where(inArray(t.lodgingVouchers.lodgingId, lodgingIds))
    .orderBy(asc(t.lodgingVouchers.createdAt));
  if (vouchers.length === 0) return byLodging;

  const voucherIds = vouchers.map((v) => v.voucher.id);
  const travelerRows = await db
    .select({ voucherId: t.lodgingVoucherTravelers.voucherId, travelerId: t.lodgingVoucherTravelers.travelerId, travelerName: t.travelers.name })
    .from(t.lodgingVoucherTravelers)
    .leftJoin(t.travelers, eq(t.travelers.id, t.lodgingVoucherTravelers.travelerId))
    .where(inArray(t.lodgingVoucherTravelers.voucherId, voucherIds));
  const travelersByVoucher = new Map<string, string[]>();
  for (const r of travelerRows) {
    const list = travelersByVoucher.get(r.voucherId) ?? [];
    list.push(r.travelerId ? r.travelerName ?? "" : "dono da viagem");
    travelersByVoucher.set(r.voucherId, list);
  }

  for (const { voucher: v } of vouchers) {
    const list = byLodging.get(v.lodgingId) ?? [];
    list.push({
      scopeLabel: v.isGroup ? "Grupo" : (travelersByVoucher.get(v.id) ?? []).join(", ") || v.name,
      price: v.price,
      currency: v.currency,
      status: v.status,
    });
    byLodging.set(v.lodgingId, list);
  }
  return byLodging;
}
