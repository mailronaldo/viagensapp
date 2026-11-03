import type { Booking, Expense, ItineraryItem } from "@/db/schema";
import { BOOKING_TYPE_LABEL, CURRENCIES, EXPENSE_CATEGORY_LABEL, ITEM_TYPE_LABEL } from "@/lib/labels";
import { Field, inputCls } from "@/components/ui";

/** "1234.50" → "1234,50" (formato do campo, aceito por parseDecimal). */
const dec = (v: string | null | undefined) => (v ? v.replace(".", ",") : "");
/** "2026-05-01 14:30:00" → "2026-05-01T14:30" (datetime-local). */
const local = (v: string | null | undefined) => (v ? v.slice(0, 16).replace(" ", "T") : "");

/** Campo de anexo: no modo edição mostra o arquivo atual e a opção de remover. */
function AttachmentField({
  label,
  name,
  removeName,
  current,
  href,
  className,
}: {
  label: string;
  name: string;
  removeName: string;
  current?: string | null;
  href?: string | null;
  className: string;
}) {
  return (
    <div className={className}>
      <Field label={current ? `${label} — enviar outro substitui o atual` : label}>
        <input name={name} type="file" accept="application/pdf,image/*" className={inputCls} />
      </Field>
      {current && (
        <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
          <a href={href ?? "#"} target="_blank" rel="noreferrer" className="text-teal-700 hover:underline">
            📎 {current}
          </a>
          <label className="inline-flex items-center gap-1">
            <input type="checkbox" name={removeName} /> remover anexo
          </label>
        </p>
      )}
    </div>
  );
}

export function ItemFields({
  trip,
  cities,
  item,
  defaultDate,
  attachment,
}: {
  trip: { id: string; startDate: string; endDate: string };
  cities: { id: string; name: string }[];
  item?: ItineraryItem;
  defaultDate?: string;
  attachment?: { name: string; href: string } | null;
}) {
  return (
    <>
      <Field label="Título" className="sm:col-span-4">
        <input name="title" required defaultValue={item?.title} placeholder="Ex.: Torre de Belém" className={inputCls} />
      </Field>
      <Field label="Tipo" className="sm:col-span-2">
        <select name="type" defaultValue={item?.type ?? "ATTRACTION"} className={inputCls}>
          {Object.entries(ITEM_TYPE_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Data" className="sm:col-span-2">
        <input
          name="date"
          type="date"
          required
          defaultValue={item?.date ?? defaultDate}
          min={trip.startDate}
          max={trip.endDate}
          className={inputCls}
        />
      </Field>
      <Field label="Início" className="sm:col-span-1">
        <input name="startTime" type="time" defaultValue={item?.startTime ?? ""} className={inputCls} />
      </Field>
      <Field label="Fim" className="sm:col-span-1">
        <input name="endTime" type="time" defaultValue={item?.endTime ?? ""} className={inputCls} />
      </Field>
      <Field label="Cidade" className="sm:col-span-2">
        <select name="cityId" className={inputCls} defaultValue={item?.cityId ?? ""}>
          <option value="">—</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Local" className="sm:col-span-3">
        <input name="location" defaultValue={item?.location ?? ""} className={inputCls} />
      </Field>
      <Field label="Endereço" className="sm:col-span-3">
        <input name="address" defaultValue={item?.address ?? ""} className={inputCls} />
      </Field>
      <Field label="Custo estimado" className="sm:col-span-2">
        <input name="costEstimate" inputMode="decimal" defaultValue={dec(item?.costEstimate)} placeholder="0,00" className={inputCls} />
      </Field>
      <AttachmentField
        label="Ingresso / voucher (PDF ou imagem)"
        name="ticket"
        removeName="removeTicket"
        current={attachment?.name}
        href={attachment?.href}
        className="sm:col-span-4"
      />
      <Field label="Observações" className="sm:col-span-6">
        <textarea name="notes" rows={2} defaultValue={item?.notes ?? ""} className={inputCls} />
      </Field>
    </>
  );
}

export function BookingFields({
  trip,
  booking,
  attachment,
}: {
  trip: { baseCurrency: string };
  booking?: Booking;
  attachment?: { name: string; href: string } | null;
}) {
  return (
    <>
      <Field label="Tipo" className="sm:col-span-2">
        <select name="type" className={inputCls} defaultValue={booking?.type ?? "FLIGHT"}>
          {Object.entries(BOOKING_TYPE_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Título" className="sm:col-span-4">
        <input name="title" required defaultValue={booking?.title} placeholder="Ex.: Voo GRU → LIS" className={inputCls} />
      </Field>
      <Field label="Companhia / fornecedor" className="sm:col-span-3">
        <input name="provider" defaultValue={booking?.provider ?? ""} className={inputCls} />
      </Field>
      <Field label="Código de confirmação" className="sm:col-span-3">
        <input name="confirmationCode" defaultValue={booking?.confirmationCode ?? ""} className={inputCls} />
      </Field>
      <Field label="Início (horário local do local)" className="sm:col-span-3">
        <input name="startAt" type="datetime-local" defaultValue={local(booking?.startAt)} className={inputCls} />
      </Field>
      <Field label="Término (horário local do local)" className="sm:col-span-3">
        <input name="endAt" type="datetime-local" defaultValue={local(booking?.endAt)} className={inputCls} />
      </Field>
      <Field label="Origem (voos/trens)" className="sm:col-span-3">
        <input name="origin" defaultValue={booking?.origin ?? ""} className={inputCls} />
      </Field>
      <Field label="Destino (voos/trens)" className="sm:col-span-3">
        <input name="destination" defaultValue={booking?.destination ?? ""} className={inputCls} />
      </Field>
      <Field label="Endereço (hotéis/locais)" className="sm:col-span-6">
        <input name="address" defaultValue={booking?.address ?? ""} className={inputCls} />
      </Field>
      <Field label="Valor total" className="sm:col-span-2">
        <input name="totalPrice" inputMode="decimal" defaultValue={dec(booking?.totalPrice)} placeholder="0,00" className={inputCls} />
      </Field>
      <Field label="Moeda" className="sm:col-span-1">
        <select name="currency" defaultValue={booking?.currency ?? trip.baseCurrency} className={inputCls}>
          {CURRENCIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      <AttachmentField
        label="Voucher / e-ticket (PDF ou imagem)"
        name="voucher"
        removeName="removeVoucher"
        current={attachment?.name}
        href={attachment?.href}
        className="sm:col-span-3"
      />
      <Field label="Detalhes" className="sm:col-span-6">
        <textarea name="details" rows={2} defaultValue={booking?.details ?? ""} className={inputCls} />
      </Field>
    </>
  );
}

export function ExpenseFields({
  trip,
  expense,
  defaultDate,
  attachment,
}: {
  trip: { baseCurrency: string };
  expense?: Expense;
  defaultDate?: string;
  attachment?: { name: string; href: string } | null;
}) {
  return (
    <>
      <Field label="Descrição" className="sm:col-span-4">
        <input name="description" required defaultValue={expense?.description} placeholder="Ex.: Jantar no Time Out Market" className={inputCls} />
      </Field>
      <Field label="Categoria" className="sm:col-span-2">
        <select name="category" defaultValue={expense?.category ?? "FOOD"} className={inputCls}>
          {Object.entries(EXPENSE_CATEGORY_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Data" className="sm:col-span-2">
        <input name="date" type="date" required defaultValue={expense?.date ?? defaultDate} className={inputCls} />
      </Field>
      <Field label="Valor" className="sm:col-span-2">
        <input name="amount" required inputMode="decimal" defaultValue={dec(expense?.amount)} placeholder="0,00" className={inputCls} />
      </Field>
      <Field label="Moeda" className="sm:col-span-1">
        <select name="currency" defaultValue={expense?.currency ?? trip.baseCurrency} className={inputCls}>
          {CURRENCIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      <Field label={`Cotação → ${trip.baseCurrency}`} hint="Só se a moeda for diferente." className="sm:col-span-1">
        <input
          name="exchangeRate"
          inputMode="decimal"
          defaultValue={expense?.exchangeRate ? String(Number(expense.exchangeRate)).replace(".", ",") : ""}
          placeholder="5,40"
          className={inputCls}
        />
      </Field>
      <Field label="Forma de pagamento" className="sm:col-span-3">
        <input name="paymentMethod" defaultValue={expense?.paymentMethod ?? ""} placeholder="Cartão, dinheiro, Pix…" className={inputCls} />
      </Field>
      <AttachmentField
        label="Nota / recibo (foto ou PDF)"
        name="receipt"
        removeName="removeReceipt"
        current={attachment?.name}
        href={attachment?.href}
        className="sm:col-span-3"
      />
    </>
  );
}
