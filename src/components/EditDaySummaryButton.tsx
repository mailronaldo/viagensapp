"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { saveDayAction } from "@/app/actions/days";
import { Field, btnPrimary, inputCls } from "@/components/ui";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** Lápis no canto do card do dia — abre modal com os campos do resumo do dia. */
export function EditDaySummaryButton({
  tripId,
  date,
  title,
  summary,
  cities,
  planCityIds,
}: {
  tripId: string;
  date: string;
  title: string | null;
  summary: string | null;
  cities: { id: string; name: string }[];
  planCityIds: string[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Editar resumo do dia"
          title="Editar resumo do dia"
          className="absolute right-3 top-3 flex size-7 items-center justify-center rounded-full text-brand-700 hover:bg-brand-50"
        >
          <Pencil className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar resumo do dia</DialogTitle>
        </DialogHeader>
        <form action={saveDayAction.bind(null, tripId, date)} className="grid gap-3">
          <Field label="Título do dia">
            <input name="title" maxLength={120} defaultValue={title ?? ""} placeholder="Ex.: Chegada e Alfama" className={inputCls} />
          </Field>
          <Field label="Descrição breve">
            <textarea name="summary" rows={3} maxLength={1000} defaultValue={summary ?? ""} className={inputCls} />
          </Field>
          <fieldset>
            <legend className="mb-1 text-xs font-medium text-slate-600">Cidades neste dia</legend>
            {cities.length === 0 ? (
              <p className="text-xs text-slate-400">Cadastre as cidades na tela do roteiro resumido.</p>
            ) : (
              <div className="flex flex-wrap gap-x-4 gap-y-1">
                {cities.map((c) => (
                  <label key={c.id} className="inline-flex items-center gap-1.5 text-sm">
                    <input type="checkbox" name="cityIds" value={c.id} defaultChecked={planCityIds.includes(c.id)} />
                    {c.name}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <div>
            <button className={btnPrimary}>Salvar resumo</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
