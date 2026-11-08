import type { Booking, Chip, Expense, ItineraryItem, Lodging, TravelInsurance } from "@/db/schema";
import { AddPanel, CategoryOptions, Field, StatusSelect, inputCls } from "@/components/ui";

type Category = { id: string; name: string };

function CurrencyOptions({ currencies }: { currencies: string[] }) {
  return (
    <>
      {currencies.map((c) => (
        <option key={c}>{c}</option>
      ))}
    </>
  );
}

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
  types,
  categories,
  item,
  defaultDate,
  attachment,
}: {
  trip: { startDate: string; endDate: string };
  cities: { id: string; name: string }[];
  types: { id: string; name: string }[];
  categories: Category[];
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
          {types.map((ty) => (
            <option key={ty.id} value={ty.id}>
              {ty.name}
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
      <Field label="Status do custo" className="sm:col-span-1">
        <StatusSelect name="costStatus" defaultValue={item?.costStatus ?? "ESTIMADO"} />
      </Field>
      <Field label="Categoria do custo" className="sm:col-span-1">
        <select name="costCategory" defaultValue={item?.costCategory ?? ""} className={inputCls}>
          <CategoryOptions categories={categories} />
        </select>
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
  currencies,
  categories,
}: {
  trip: { baseCurrency: string };
  item?: ItineraryItem;
  reservationAttachment?: { name: string; href: string } | null;
  formId?: string;
  currencies: string[];
  categories: Category[];
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
          <CurrencyOptions currencies={currencies} />
        </select>
      </Field>
      <Field label="Status do valor">
        <StatusSelect name="reservationStatus" form={formId} defaultValue={item?.reservationStatus ?? "ESTIMADO"} />
      </Field>
      <Field label="Categoria">
        <select name="reservationCategory" form={formId} defaultValue={item?.reservationCategory ?? ""} className={inputCls}>
          <CategoryOptions categories={categories} />
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
  types,
  categories,
  item,
  defaultDate,
  attachment,
  reservationAttachment,
  currencies,
}: {
  trip: { id: string; startDate: string; endDate: string; baseCurrency: string };
  cities: { id: string; name: string }[];
  types: { id: string; name: string }[];
  categories: Category[];
  item?: ItineraryItem;
  defaultDate?: string;
  attachment?: { name: string; href: string } | null;
  reservationAttachment?: { name: string; href: string } | null;
  currencies: string[];
}) {
  return (
    <>
      <ItemMainFields trip={trip} cities={cities} types={types} categories={categories} item={item} defaultDate={defaultDate} attachment={attachment} />
      <div id="reserva" className="sm:col-span-6">
        <AddPanel title="Reserva desta atividade (opcional — preencha se já reservou)" defaultOpen={false}>
          <ReservationFields trip={trip} item={item} reservationAttachment={reservationAttachment} currencies={currencies} categories={categories} />
        </AddPanel>
      </div>
    </>
  );
}

export function LodgingFields({
  trip,
  cities,
  types,
  methods,
  categories,
  lodging,
  defaultDate,
  attachment,
  currencies,
}: {
  trip: { baseCurrency: string };
  cities: { id: string; name: string }[];
  types: { id: string; name: string }[];
  methods: { id: string; name: string }[];
  categories: Category[];
  lodging?: Lodging;
  defaultDate?: string;
  attachment?: { name: string; href: string } | null;
  currencies: string[];
}) {
  return (
    <>
      <Field label="Nome" className="sm:col-span-4">
        <input name="name" required defaultValue={lodging?.name} placeholder="Ex.: Hotel Avenida Palace" className={inputCls} />
      </Field>
      <Field label="Tipo" className="sm:col-span-2">
        <select name="type" defaultValue={lodging?.type ?? "HOTEL"} className={inputCls}>
          {types.map((ty) => (
            <option key={ty.id} value={ty.id}>
              {ty.name}
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
      <Field label="Método de reserva" className="sm:col-span-2">
        <select name="provider" defaultValue={lodging?.provider ?? ""} className={inputCls}>
          <option value="">—</option>
          {methods.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Código de confirmação" className="sm:col-span-2">
        <input name="confirmationCode" defaultValue={lodging?.confirmationCode ?? ""} className={inputCls} />
      </Field>
      <Field label="Check-in (data)" className="sm:col-span-2">
        <input name="checkInDate" type="date" defaultValue={lodging?.checkInDate ?? defaultDate ?? ""} className={inputCls} />
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
          <CurrencyOptions currencies={currencies} />
        </select>
      </Field>
      <Field label="Status do valor" className="sm:col-span-1">
        <StatusSelect name="status" defaultValue={lodging?.status ?? "ESTIMADO"} />
      </Field>
      <Field label="Categoria" className="sm:col-span-1">
        <select name="category" defaultValue={lodging?.category ?? ""} className={inputCls}>
          <CategoryOptions categories={categories} />
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

/** Um dos dois lados (origem/destino) do trecho de transporte. */
function BookingLegFields({
  legLabel,
  prefix,
  cities,
  booking,
  defaultDateTime,
}: {
  legLabel: string;
  prefix: "origin" | "destination";
  cities: { id: string; name: string }[];
  booking?: Booking;
  defaultDateTime?: string;
}) {
  const at = prefix === "origin" ? booking?.originAt : booking?.destinationAt;
  const loc = prefix === "origin" ? booking?.originLocation : booking?.destinationLocation;
  const cityId = prefix === "origin" ? booking?.originCityId : booking?.destinationCityId;
  return (
    <fieldset className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:col-span-6 sm:grid-cols-6">
      <legend className="px-1 text-xs font-medium text-slate-600">{legLabel}</legend>
      <Field label="Data/hora" className="sm:col-span-2">
        <input name={`${prefix}At`} type="datetime-local" defaultValue={local(at) || defaultDateTime || ""} className={inputCls} />
      </Field>
      <Field label="Local" className="sm:col-span-2">
        <input name={`${prefix}Location`} defaultValue={loc ?? ""} className={inputCls} />
      </Field>
      <Field label="Cidade" className="sm:col-span-2">
        <select name={`${prefix}CityId`} defaultValue={cityId ?? ""} className={inputCls}>
          <option value="">—</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
    </fieldset>
  );
}

export function BookingFields({
  trip,
  cities,
  types,
  categories,
  booking,
  defaultDate,
  attachment,
  currencies,
}: {
  trip: { baseCurrency: string };
  cities: { id: string; name: string }[];
  types: { id: string; name: string }[];
  categories: Category[];
  booking?: Booking;
  defaultDate?: string;
  attachment?: { name: string; href: string } | null;
  currencies: string[];
}) {
  return (
    <>
      <Field label="Tipo" className="sm:col-span-2">
        <select name="type" className={inputCls} defaultValue={booking?.type ?? "FLIGHT"}>
          {types.map((ty) => (
            <option key={ty.id} value={ty.id}>
              {ty.name}
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
      <Field label="Número do pedido" className="sm:col-span-3">
        <input name="orderNumber" defaultValue={booking?.orderNumber ?? ""} className={inputCls} />
      </Field>
      <BookingLegFields
        legLabel="Origem"
        prefix="origin"
        cities={cities}
        booking={booking}
        defaultDateTime={defaultDate ? `${defaultDate}T09:00` : undefined}
      />
      <BookingLegFields legLabel="Destino" prefix="destination" cities={cities} booking={booking} />
      <fieldset
        id="reserva"
        className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:col-span-6 sm:grid-cols-6"
      >
        <legend className="px-1 text-xs font-medium text-slate-600">
          Reserva deste transporte (opcional — preencha se já reservou)
        </legend>
        <Field label="Valor total" className="sm:col-span-2">
          <input name="totalPrice" inputMode="decimal" defaultValue={dec(booking?.totalPrice)} placeholder="0,00" className={inputCls} />
        </Field>
        <Field label="Moeda" className="sm:col-span-1">
          <select name="currency" defaultValue={booking?.currency ?? trip.baseCurrency} className={inputCls}>
            <CurrencyOptions currencies={currencies} />
          </select>
        </Field>
        <Field label="Status do valor" className="sm:col-span-1">
          <StatusSelect name="status" defaultValue={booking?.status ?? "ESTIMADO"} />
        </Field>
        <Field label="Categoria" className="sm:col-span-2">
          <select name="category" defaultValue={booking?.category ?? ""} className={inputCls}>
            <CategoryOptions categories={categories} />
          </select>
        </Field>
        <Field label="Código de confirmação" className="sm:col-span-3">
          <input name="confirmationCode" defaultValue={booking?.confirmationCode ?? ""} className={inputCls} />
        </Field>
        <AttachmentField
          label="Voucher / e-ticket (PDF ou imagem)"
          name="voucher"
          removeName="removeVoucher"
          current={attachment?.name}
          href={attachment?.href}
          className="sm:col-span-6"
        />
        <Field label="Detalhes" className="sm:col-span-6">
          <textarea name="details" rows={2} defaultValue={booking?.details ?? ""} className={inputCls} />
        </Field>
      </fieldset>
    </>
  );
}

export function ChipFields({
  trip,
  chip,
  attachment,
  currencies,
  categories,
}: {
  trip: { baseCurrency: string };
  chip?: Chip;
  attachment?: { name: string; href: string } | null;
  currencies: string[];
  categories: Category[];
}) {
  return (
    <fieldset id="chip" className="grid gap-3 rounded-lg border border-slate-200 p-3 sm:col-span-6 sm:grid-cols-6">
      <legend className="px-1 text-xs font-medium text-slate-600">
        Internet / Telefonia (opcional — preencha se o viajante tiver chip ou eSIM nesta viagem)
      </legend>
      <Field label="Fornecedor / companhia" className="sm:col-span-3">
        <input name="provider" defaultValue={chip?.provider ?? ""} className={inputCls} />
      </Field>
      <Field label="Número do pedido" className="sm:col-span-3">
        <input name="orderNumber" defaultValue={chip?.orderNumber ?? ""} className={inputCls} />
      </Field>
      <Field label="Plano" className="sm:col-span-2">
        <input name="plan" defaultValue={chip?.plan ?? ""} className={inputCls} />
      </Field>
      <Field label="Custo" className="sm:col-span-2">
        <input name="cost" inputMode="decimal" defaultValue={dec(chip?.cost)} placeholder="0,00" className={inputCls} />
      </Field>
      <Field label="Moeda" className="sm:col-span-2">
        <select name="currency" defaultValue={chip?.currency ?? trip.baseCurrency} className={inputCls}>
          <CurrencyOptions currencies={currencies} />
        </select>
      </Field>
      <Field label="Status do valor" className="sm:col-span-2">
        <StatusSelect name="status" defaultValue={chip?.status ?? "ESTIMADO"} />
      </Field>
      <Field label="Categoria" className="sm:col-span-2">
        <select name="category" defaultValue={chip?.category ?? ""} className={inputCls}>
          <CategoryOptions categories={categories} />
        </select>
      </Field>
      <AttachmentField
        label="Recibo (PDF ou imagem)"
        name="receipt"
        removeName="removeReceipt"
        current={attachment?.name}
        href={attachment?.href}
        className="sm:col-span-6"
      />
      <Field label="Data início" className="sm:col-span-2">
        <input name="startDate" type="date" defaultValue={chip?.startDate ?? ""} className={inputCls} />
      </Field>
      <Field label="Data término" className="sm:col-span-2">
        <input name="endDate" type="date" defaultValue={chip?.endDate ?? ""} className={inputCls} />
      </Field>
      <Field label="Tipo" className="sm:col-span-2">
        <select name="type" defaultValue={chip?.type ?? "CHIP"} className={inputCls}>
          <option value="CHIP">Chip</option>
          <option value="ESIM">eSIM</option>
        </select>
      </Field>
      <Field label="EID (32 dígitos)" className="sm:col-span-3">
        <input name="eid" defaultValue={chip?.eid ?? ""} inputMode="numeric" maxLength={32} className={inputCls} />
      </Field>
      <Field label="IMEI2 (15 dígitos)" className="sm:col-span-3">
        <input name="imei2" defaultValue={chip?.imei2 ?? ""} inputMode="numeric" maxLength={15} className={inputCls} />
      </Field>
    </fieldset>
  );
}

export function ExpenseFields({
  trip,
  expense,
  categories,
  defaultDate,
  attachment,
  currencies,
}: {
  trip: { baseCurrency: string };
  expense?: Expense;
  categories: { id: string; name: string }[];
  defaultDate?: string;
  attachment?: { name: string; href: string } | null;
  currencies: string[];
}) {
  return (
    <>
      <Field label="Descrição" className="sm:col-span-4">
        <input name="description" required defaultValue={expense?.description} placeholder="Ex.: Jantar no Time Out Market" className={inputCls} />
      </Field>
      <Field label="Categoria" className="sm:col-span-2">
        <select name="category" defaultValue={expense?.category ?? categories[0]?.id} className={inputCls}>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Status do valor" className="sm:col-span-2">
        <StatusSelect name="status" defaultValue={expense?.status ?? "ESTIMADO"} />
      </Field>
      <Field label="Data" className="sm:col-span-2">
        <input name="date" type="date" required defaultValue={expense?.date ?? defaultDate} className={inputCls} />
      </Field>
      <Field label="Valor" className="sm:col-span-2">
        <input name="amount" required inputMode="decimal" defaultValue={dec(expense?.amount)} placeholder="0,00" className={inputCls} />
      </Field>
      <Field label="Moeda" className="sm:col-span-1">
        <select name="currency" defaultValue={expense?.currency ?? trip.baseCurrency} className={inputCls}>
          <CurrencyOptions currencies={currencies} />
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

export function TicketFields({
  trip,
  travelers,
  currencies,
  categories,
}: {
  trip: { baseCurrency: string };
  travelers: { id: string | null; name: string }[];
  currencies: string[];
  categories: Category[];
}) {
  return (
    <>
      <Field label="Viajante" className="sm:col-span-6">
        <select name="travelerId" required className={inputCls}>
          <option value="">Selecione…</option>
          {travelers.map((tr) => (
            <option key={tr.id ?? "owner"} value={tr.id ?? "owner"}>
              {tr.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Fornecedor" className="sm:col-span-3">
        <input name="provider" className={inputCls} />
      </Field>
      <Field label="Número do ticket" className="sm:col-span-3">
        <input name="ticketNumber" className={inputCls} />
      </Field>
      <Field label="Valor" className="sm:col-span-2">
        <input name="price" inputMode="decimal" placeholder="0,00" className={inputCls} />
      </Field>
      <Field label="Moeda" className="sm:col-span-1">
        <select name="currency" defaultValue={trip.baseCurrency} className={inputCls}>
          <CurrencyOptions currencies={currencies} />
        </select>
      </Field>
      <Field label="Status do valor" className="sm:col-span-1">
        <StatusSelect name="status" />
      </Field>
      <Field label="Categoria" className="sm:col-span-1">
        <select name="category" defaultValue="" className={inputCls}>
          <CategoryOptions categories={categories} />
        </select>
      </Field>
      <AttachmentField label="Voucher (PDF ou imagem)" name="voucher" removeName="removeVoucher" className="sm:col-span-3" />
      <Field label="Detalhes" className="sm:col-span-6">
        <textarea name="details" rows={2} className={inputCls} />
      </Field>
    </>
  );
}

export function PassFields({
  trip,
  currencies,
  categories,
}: {
  trip: { baseCurrency: string };
  currencies: string[];
  categories: Category[];
}) {
  return (
    <>
      <Field label="Nome do passe" className="sm:col-span-4">
        <input name="name" required placeholder="Ex.: New York Explorer Pass" className={inputCls} />
      </Field>
      <Field label="Fornecedor" className="sm:col-span-2">
        <input name="provider" className={inputCls} />
      </Field>
      <Field label="Validade em dias" hint="A partir do primeiro uso." className="sm:col-span-2">
        <input name="validityDays" inputMode="numeric" className={inputCls} />
      </Field>
      <Field label="Número de atrações" hint="Máximo de entradas permitidas." className="sm:col-span-2">
        <input name="maxUses" inputMode="numeric" className={inputCls} />
      </Field>
      <Field label="Número do passe" className="sm:col-span-2">
        <input name="passNumber" className={inputCls} />
      </Field>
      <Field label="Valor" className="sm:col-span-2">
        <input name="price" inputMode="decimal" placeholder="0,00" className={inputCls} />
      </Field>
      <Field label="Moeda" className="sm:col-span-2">
        <select name="currency" defaultValue={trip.baseCurrency} className={inputCls}>
          <CurrencyOptions currencies={currencies} />
        </select>
      </Field>
      <Field label="Status do valor" className="sm:col-span-2">
        <StatusSelect name="status" />
      </Field>
      <Field label="Categoria" className="sm:col-span-2">
        <select name="category" defaultValue="" className={inputCls}>
          <CategoryOptions categories={categories} />
        </select>
      </Field>
    </>
  );
}

export function InsuranceFields({
  trip,
  insurance,
  attachment,
  currencies,
  categories,
}: {
  trip: { baseCurrency: string };
  insurance?: TravelInsurance | null;
  attachment?: { name: string; href: string } | null;
  currencies: string[];
  categories: Category[];
}) {
  return (
    <>
      <Field label="Seguradora / fornecedor" className="sm:col-span-3">
        <input name="provider" defaultValue={insurance?.provider ?? ""} className={inputCls} />
      </Field>
      <Field label="Número da apólice" className="sm:col-span-3">
        <input name="policyNumber" defaultValue={insurance?.policyNumber ?? ""} className={inputCls} />
      </Field>
      <Field label="Cobertura" className="sm:col-span-2">
        <input name="coverageAmount" inputMode="decimal" defaultValue={dec(insurance?.coverageAmount)} placeholder="0,00" className={inputCls} />
      </Field>
      <Field label="Moeda da cobertura" className="sm:col-span-2">
        <select name="coverageCurrency" defaultValue={insurance?.coverageCurrency ?? trip.baseCurrency} className={inputCls}>
          <CurrencyOptions currencies={currencies} />
        </select>
      </Field>
      <Field label="Vigência início" className="sm:col-span-1">
        <input name="startDate" type="date" defaultValue={insurance?.startDate ?? ""} className={inputCls} />
      </Field>
      <Field label="Vigência término" className="sm:col-span-1">
        <input name="endDate" type="date" defaultValue={insurance?.endDate ?? ""} className={inputCls} />
      </Field>
      <Field label="Valor" className="sm:col-span-2">
        <input name="price" inputMode="decimal" defaultValue={dec(insurance?.price)} placeholder="0,00" className={inputCls} />
      </Field>
      <Field label="Moeda" className="sm:col-span-1">
        <select name="currency" defaultValue={insurance?.currency ?? trip.baseCurrency} className={inputCls}>
          <CurrencyOptions currencies={currencies} />
        </select>
      </Field>
      <Field label="Status do valor" className="sm:col-span-1">
        <StatusSelect name="status" defaultValue={insurance?.status ?? "ESTIMADO"} />
      </Field>
      <Field label="Categoria" className="sm:col-span-2">
        <select name="category" defaultValue={insurance?.category ?? ""} className={inputCls}>
          <CategoryOptions categories={categories} />
        </select>
      </Field>
      <AttachmentField
        label="Apólice (PDF ou imagem)"
        name="policy"
        removeName="removePolicy"
        current={attachment?.name}
        href={attachment?.href}
        className="sm:col-span-6"
      />
      <Field label="Observações" className="sm:col-span-6">
        <textarea name="notes" rows={2} defaultValue={insurance?.notes ?? ""} className={inputCls} />
      </Field>
    </>
  );
}
