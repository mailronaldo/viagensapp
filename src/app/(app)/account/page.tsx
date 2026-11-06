import { requireClient } from "@/lib/auth";
import { updateMyAccountAction } from "@/app/actions/account";
import { SavedModal } from "@/components/SavedModal";
import { Card, ErrorBanner, Field, btnPrimary, inputCls } from "@/components/ui";

export const metadata = { title: "Minha conta" };

export default async function MyAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const user = await requireClient();
  const { error, saved } = await searchParams;

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
    </div>
  );
}
