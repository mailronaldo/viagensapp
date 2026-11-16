"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { addStoreAction } from "@/app/actions/stores";
import { Field, btnGhost, btnPrimary, inputCls } from "@/components/ui";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

/** "+" ao lado do combo de Loja — cadastro rápido, sem gestor dedicado. */
export function AddStoreButton({
  tripId,
  back,
  cities,
}: {
  tripId: string;
  back: string;
  cities: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState<"PHYSICAL" | "ONLINE">("PHYSICAL");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Nova loja"
          title="Nova loja"
          className="flex size-10 shrink-0 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50"
        >
          <Plus className="size-4" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nova loja</DialogTitle>
        </DialogHeader>
        <form action={addStoreAction.bind(null, tripId, back)} className="grid gap-3">
          <Field label="Nome">
            <input name="name" required placeholder="Ex.: Amazon, Shopping Center Norte" className={inputCls} />
          </Field>
          <Field label="Tipo">
            <select name="type" value={type} onChange={(e) => setType(e.target.value as "PHYSICAL" | "ONLINE")} className={inputCls}>
              <option value="PHYSICAL">Física</option>
              <option value="ONLINE">Online</option>
            </select>
          </Field>
          {type === "PHYSICAL" && (
            <Field label="Cidade" hint="Só cidades desta viagem.">
              <select name="cityId" required={type === "PHYSICAL"} className={inputCls}>
                <option value="" disabled>
                  Selecione…
                </option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <DialogFooter>
            <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
              Cancelar
            </button>
            <button className={btnPrimary}>Salvar loja</button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
