import { and, eq, isNull } from "drizzle-orm";
import { db, t } from "@/db";
import { requireClient } from "@/lib/auth";
import { updateMyAccountAction } from "@/app/actions/account";
import { generateTelegramLinkForOwnerAction, unlinkTelegramForOwnerAction } from "@/app/actions/telegram";
import { SavedModal } from "@/components/SavedModal";
import { TelegramLinkForm } from "@/components/TelegramLink";
import { Card, ErrorBanner, Field, btnGhost, btnPrimary, inputCls } from "@/components/ui";

export const metadata = { title: "Minha conta" };

export default async function MyAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const user = await requireClient();
  const { error, saved } = await searchParams;

  const [telegramLink] = await db
    .select({ id: t.telegramLinks.id })
    .from(t.telegramLinks)
    .where(and(eq(t.telegramLinks.clientId, user.id), isNull(t.telegramLinks.travelerId)))
    .limit(1);

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="mb-4 text-xl font-semibold">Minha conta</h1>
      {saved === "1" && (
        <SavedModal key={saved} show title="Dados salvos ✓" body="Seus dados foram atualizados." cleanUrl="/account" />
      )}
      <Card>
        <ErrorBanner message={error} />
        <form action={updateMyAccountAction} className="space-y-3">
          <Field label="Nome">
            <input name="name" required defaultValue={user.name} className={inputCls} />
          </Field>
          <Field label="E-mail (login)">
            <input name="email" type="email" required defaultValue={user.email} className={inputCls} />
          </Field>
          <button className={btnPrimary}>Salvar</button>
        </form>
      </Card>
      <Card className="mt-6">
        <h2 className="mb-1 font-medium">Agente no Telegram</h2>
        <p className="mb-3 text-sm text-slate-600">
          Com o vínculo, você conversa com o agente de viagens pelo Telegram sobre as viagens em que você mesmo
          viaja (agenda do dia, vouchers, etc.), sem precisar do painel web.
        </p>
        <p className="mb-3 text-sm">
          Status: <strong className={telegramLink ? "text-emerald-700" : "text-slate-500"}>{telegramLink ? "vinculado" : "não vinculado"}</strong>
        </p>
        <TelegramLinkForm action={generateTelegramLinkForOwnerAction} linked={!!telegramLink} />
        {telegramLink && (
          <form action={unlinkTelegramForOwnerAction} className="mt-3">
            <button className={btnGhost}>Remover vínculo</button>
          </form>
        )}
      </Card>
    </div>
  );
}
