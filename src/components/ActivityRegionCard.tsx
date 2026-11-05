import { X } from "lucide-react";
import { Card, btnPrimary, inputCls } from "@/components/ui";

type Region = { id: string; name: string };

export function ActivityRegionCard({
  items,
  addAction,
  deleteAction,
}: {
  items: Region[];
  /** Server action já vinculada a (tripId, itemId) — falta só o FormData (campo `name`). */
  addAction: (formData: FormData) => void;
  /** Server action já vinculada a (tripId, itemId) — falta só o id da região. */
  deleteAction: (regionId: string) => void;
}) {
  return (
    <Card>
      <h3 className="mb-2 font-medium">Região</h3>
      <p className="mb-2 text-xs text-slate-500">Bairro, zona ou região próxima a esta atividade.</p>
      {items.length > 0 && (
        <ul className="mb-3 flex flex-wrap gap-1.5">
          {items.map((r) => (
            <li key={r.id}>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 ps-3 pe-1.5 text-xs text-brand-900">
                {r.name}
                <form action={deleteAction.bind(null, r.id)}>
                  <button aria-label={`Remover ${r.name}`} className="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full text-brand-700 hover:bg-brand-200 hover:text-rose-700">
                    <X className="size-3" />
                  </button>
                </form>
              </span>
            </li>
          ))}
        </ul>
      )}
      <form action={addAction} className="flex gap-2">
        <input name="name" placeholder="Ex.: Alfama" className={`${inputCls} text-sm`} />
        <button className={`${btnPrimary} shrink-0 px-3`}>+</button>
      </form>
    </Card>
  );
}
