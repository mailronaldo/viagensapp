import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, t } from "@/db";
import { requireClient } from "@/lib/auth";
import { deleteTravelerAction, setTravelerAccessActiveAction, updateTravelerAction } from "@/app/actions/travelers";
import { generateTelegramLinkAction, unlinkTelegramAction } from "@/app/actions/telegram";
import { TravelerAccessForm } from "@/components/TravelerAccess";
import { TelegramLinkForm } from "@/components/TelegramLink";
import { getLoginUrl } from "@/lib/origin";
import { Card, ErrorBanner, Field, btnDanger, btnGhost, btnPrimary, inputCls } from "@/components/ui";

export const metadata = { title: "Editar viajante" };

export default async function EditTravelerPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await requireClient();
  const { id } = await params;
  const { error } = await searchParams;

  // Filtra pelo cliente logado: viajante de outro cliente "não existe".
  const [tr] = await db
    .select()
    .from(t.travelers)
    .where(and(eq(t.travelers.id, id), eq(t.travelers.clientId, user.id)))
    .limit(1);
  if (!tr) notFound();

  const [login] = tr.userId
    ? await db
        .select({ active: t.users.active, mustChangePassword: t.users.mustChangePassword })
        .from(t.users)
        .where(eq(t.users.id, tr.userId))
        .limit(1)
    : [];
  const loginUrl = await getLoginUrl();

  const [telegramLink] = await db
    .select({ id: t.telegramLinks.id })
    .from(t.telegramLinks)
    .where(eq(t.telegramLinks.travelerId, tr.id))
    .limit(1);

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/travelers" className="text-xs text-slate-500 hover:underline">
        ← Viajantes
      </Link>
      <h1 className="mb-4 mt-2 text-xl font-semibold">{tr.name}</h1>
      <Card>
        <ErrorBanner message={error} />
        <form action={updateTravelerAction.bind(null, tr.id)} className="grid gap-3 sm:grid-cols-6">
          <Field label="Nome completo" className="sm:col-span-4">
            <input name="name" required defaultValue={tr.name} className={inputCls} />
          </Field>
          <Field label="Nascimento" className="sm:col-span-2">
            <input name="birthDate" type="date" defaultValue={tr.birthDate ?? ""} className={inputCls} />
          </Field>
          <Field label="E-mail" className="sm:col-span-3">
            <input
              name="email"
              type="email"
              defaultValue={tr.email ?? ""}
              readOnly={!!tr.userId}
              className={inputCls}
            />
          </Field>
          <Field label="Telefone / WhatsApp" className="sm:col-span-3">
            <input name="phone" inputMode="tel" defaultValue={tr.phone ?? ""} className={inputCls} />
          </Field>
          <Field label="Documento (passaporte, RG ou CPF)" className="sm:col-span-6">
            <input name="documentNumber" defaultValue={tr.documentNumber ?? ""} className={inputCls} />
          </Field>
          <Field label="Observações" className="sm:col-span-6">
            <textarea name="notes" rows={3} defaultValue={tr.notes ?? ""} className={inputCls} />
          </Field>
          <div className="sm:col-span-6">
            <button className={btnPrimary}>Salvar</button>
          </div>
        </form>
      </Card>
      <Card className="mt-6">
        <h2 className="mb-1 font-medium">Acesso ao painel do viajante</h2>
        <p className="mb-3 text-sm text-slate-600">
          Com o acesso, {tr.name.split(" ")[0]} entra com o e-mail do cadastro e vê, somente para leitura, o
          roteiro, as agendas, transportes, hospedagens e os documentos liberados para ele nas viagens em que
          estiver no grupo.
        </p>
        {tr.userId ? (
          <p className="mb-3 text-sm">
            Status:{" "}
            <strong className={login?.active ? "text-emerald-700" : "text-rose-700"}>
              {login?.active ? "ativo" : "desativado"}
            </strong>
            {login?.mustChangePassword ? " · ainda não trocou a senha temporária" : ""}
          </p>
        ) : !tr.email ? (
          <p className="mb-3 text-sm text-amber-700">Cadastre o e-mail do viajante acima e salve para poder gerar o acesso.</p>
        ) : null}
        {tr.email && (
          <TravelerAccessForm travelerId={tr.id} hasAccess={!!tr.userId} loginUrl={loginUrl} />
        )}
        {tr.userId && (
          <form action={setTravelerAccessActiveAction.bind(null, tr.id, !login?.active)} className="mt-3">
            <button className={btnGhost}>{login?.active ? "Desativar acesso" : "Reativar acesso"}</button>
          </form>
        )}
      </Card>
      <Card className="mt-6">
        <h2 className="mb-1 font-medium">Agente no Telegram</h2>
        <p className="mb-3 text-sm text-slate-600">
          Com o vínculo, {tr.name.split(" ")[0]} conversa com o agente de viagens pelo Telegram durante a viagem
          (agenda do dia, vouchers, etc.), sem precisar do painel web.
        </p>
        <p className="mb-3 text-sm">
          Status: <strong className={telegramLink ? "text-emerald-700" : "text-slate-500"}>{telegramLink ? "vinculado" : "não vinculado"}</strong>
        </p>
        <TelegramLinkForm action={generateTelegramLinkAction} linked={!!telegramLink} hiddenFields={{ travelerId: tr.id }} />
        {telegramLink && (
          <form action={unlinkTelegramAction.bind(null, tr.id)} className="mt-3">
            <button className={btnGhost}>Remover vínculo</button>
          </form>
        )}
      </Card>
      <form action={deleteTravelerAction.bind(null, tr.id)} className="mt-4">
        <button className={btnDanger}>Excluir este viajante</button>
      </form>
    </div>
  );
}
