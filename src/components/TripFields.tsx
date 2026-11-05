import type { Booking, Expense, ItineraryItem, Lodging } from "@/db/schema";
import {
  BOOKING_TYPE_LABEL,
  BOOKING_TYPE_OPTIONS,
  CURRENCIES,
  EXPENSE_CATEGORY_LABEL,
  ITEM_TYPE_LABEL,
  LODGING_TYPE_LABEL,
} from "@/lib/labels";
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
          <a href={href ?? "#"} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
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

export function ItemMainFields({
  trip,
  cities,
  item,
  defaultDate,
  attachment,
}: {
  trip: { startDate: string; endDate: string };
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

/**
 * Campos da reserva. `formId`, quando informado, faz os campos valerem pro
 * form daquele id mesmo renderizados fora dele (atributo `form=`) — é o que
 * permite colocar isso num card na lateral, fora do <form> principal.
 */
export function ReservationFields({
  trip,
  item,
  reservationAttachment,
  formId,
}: {
  trip: { baseCurrency: string };
  item?: ItineraryItem;
  reservationAttachment?: { name: string; href: string } | null;
  formId?: string;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Fornecedor / site" className="sm:col-span-2">
        <input name="reservationProvider" form={formId} defaultValue={item?.reservationProvider ?? ""} className={inputCls} />
      </Field>
      <Field label="Código da reserva" className="sm:col-span-2">
        <input name="reservationCode" form={formId} defaultValue={item?.reservationCode ?? ""} className={inputCls} />
      </Field>
      <Field label="Valor">
        <input
          name="reservationPrice"
          form={formId}
          inputMode="decimal"
          defaultValue={dec(item?.reservationPrice)}
          placeholder="0,00"
          className={inputCls}
        />
      </Field>
      <Field label="Moeda">
        <select name="reservationCurrency" form={formId} defaultValue={item?.reservationCurrency ?? trip.baseCurrency} className={inputCls}>
          {CURRENCIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      <div className="sm:col-span-2">
        <Field label={reservationAttachment ? "Voucher — enviar outro substitui o atual" : "Voucher (PDF ou imagem)"}>
          <input name="reservationVoucher" form={formId} type="file" accept="application/pdf,image/*" className={inputCls} />
        </Field>
        {reservationAttachment && (
          <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-slate-500">
            <a href={reservationAttachment.href} target="_blank" rel="noreferrer" className="text-brand-700 hover:underline">
              📎 {reservationAttachment.name}
            </a>
            <label className="inline-flex items-center gap-1">
              <input type="checkbox" name="removeReservationVoucher" form={formId} /> remover anexo
            </label>
          </p>
        )}
      </div>
      <Field label="Detalhes" className="sm:col-span-2">
        <textarea name="reservationDetails" form={formId} rows={2} defaultValue={item?.reservationDetails ?? ""} className={inputCls} />
      </Field>
    </div>
  );
}

/** Usado no formulário rápido de criação (página do dia): tudo num <form> só, sem card lateral. */
export function ItemFields({
  trip,
  cities,
  item,
  defaultDate,
  attachment,
  reservationAttachment,
}: {
  trip: { id: string; startDate: string; endDate: string; baseCurrency: string };
  cities: { id: string; name: string }[];
  item?: ItineraryItem;
  defaultDate?: string;
  attachment?: { name: string; href: string } | null;
  reservationAttachment?: { name: string; href: string } | null;
}) {
  return (
    <>
      <ItemMainFields trip={trip} cities={cities} item={item} defaultDate={defaultDate} attachment={attachment} />
      <fieldset id="reserva" className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:col-span-6 sm:grid-cols-6">
        <legend className="px-1 text-xs font-medium text-slate-600">
          Reserva desta atividade (opcional — preencha se já reservou)
        </legend>
        <div className="sm:col-span-6">
          <ReservationFields trip={trip} item={item} reservationAttachment={reservationAttachment} />
        </div>
      </fieldset>
    </>
  );
}

export function LodgingFields({
  trip,
  cities,
  lodging,
  attachment,
}: {
  trip: { baseCurrency: string };
  cities: { id: string; name: string }[];
  lodging?: Lodging;
  attachment?: { name: string; href: string } | null;
}) {
  return (
    <>
      <Field label="Nome" className="sm:col-span-4">
        <input name="name" required defaultValue={lodging?.name} placeholder="Ex.: Hotel Avenida Palace" className={inputCls} />
      </Field>
      <Field label="Tipo" className="sm:col-span-2">
        <select name="type" defaultValue={lodging?.type ?? "HOTEL"} className={inputCls}>
          {Object.entries(LODGING_TYPE_LABEL).map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Cidade" className="sm:col-span-2">
        <select name="cityId" defaultValue={lodging?.cityId ?? ""} className={inputCls}>
          <option value="">—</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Site / plataforma" className="sm:col-span-2">
        <input name="provider" defaultValue={lodging?.provider ?? ""} placeholder="Booking, Airbnb…" className={inputCls} />
      </Field>
      <Field label="Código de confirmação" className="sm:col-span-2">
        <input name="confirmationCode" defaultValue={lodging?.confirmationCode ?? ""} className={inputCls} />
      </Field>
      <Field label="Check-in (data)" className="sm:col-span-2">
        <input name="checkInDate" type="date" defaultValue={lodging?.checkInDate ?? ""} className={inputCls} />
      </Field>
      <Field label="Check-in (hora)" className="sm:col-span-1">
        <input name="checkInTime" type="time" defaultValue={lodging?.checkInTime ?? ""} className={inputCls} />
      </Field>
      <Field label="Check-out (data)" className="sm:col-span-2">
        <input name="checkOutDate" type="date" defaultValue={lodging?.checkOutDate ?? ""} className={inputCls} />
      </Field>
      <Field label="Check-out (hora)" className="sm:col-span-1">
        <input name="checkOutTime" type="time" defaultValue={lodging?.checkOutTime ?? ""} className={inputCls} />
      </Field>
      <Field label="Endereço" className="sm:col-span-6">
        <input name="address" defaultValue={lodging?.address ?? ""} className={inputCls} />
      </Field>
      <Field label="Valor total" className="sm:col-span-2">
        <input name="totalPrice" inputMode="decimal" defaultValue={dec(lodging?.totalPrice)} placeholder="0,00" className={inputCls} />
      </Field>
      <Field label="Moeda" className="sm:col-span-1">
        <select name="currency" defaultValue={lodging?.currency ?? trip.baseCurrency} className={inputCls}>
          {CURRENCIES.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </Field>
      <AttachmentField
        label="Voucher / confirmação (PDF ou imagem)"
        name="voucher"
        removeName="removeVoucher"
        current={attachment?.name}
        href={attachment?.href}
        className="sm:col-span-3"
      />
      <Field label="Observações" className="sm:col-span-6">
        <textarea name="notes" rows={2} defaultValue={lodging?.notes ?? ""} className={inputCls} />
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
          {BOOKING_TYPE_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {BOOKING_TYPE_LABEL[v]}
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
