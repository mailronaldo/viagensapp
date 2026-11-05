"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, Field, btnGhost, btnPrimary, inputCls } from "@/components/ui";

type Point = { id: string; name: string; description: string | null; url: string | null };

export function ActivityPointCard({
  title,
  hint,
  items,
  addAction,
  deleteAction,
}: {
  title: string;
  hint?: string;
  items: Point[];
  /** Server action já vinculada a (tripId, itemId, kind) — falta só o FormData do modal. */
  addAction: (formData: FormData) => void;
  /** Server action já vinculada a (tripId, itemId) — falta só o id do ponto. */
  deleteAction: (pointId: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Card>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-medium">{title}</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label={`Adicionar em ${title}`}
              className="flex size-7 cursor-pointer items-center justify-center rounded-full bg-brand-50 text-brand-700 hover:bg-brand-100"
            >
              <Plus className="size-4" />
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            <form action={addAction} className="space-y-3">
              <Field label="Nome">
                <input name="name" required className={inputCls} />
              </Field>
              <Field label="Descrição">
                <textarea name="description" rows={2} className={inputCls} />
              </Field>
              <Field label="Link (URL)">
                <input name="url" type="text" placeholder="https://" className={inputCls} />
              </Field>
              <DialogFooter>
                <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
                  Cancelar
                </button>
                <button className={btnPrimary}>Salvar</button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      {hint && <p className="mb-2 text-xs text-slate-500">{hint}</p>}
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">Nada cadastrado ainda.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((p) => (
            <li key={p.id}>
              <span
                className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand-50 py-1 ps-3 pe-1.5 text-xs text-brand-900"
                title={p.description ?? undefined}
              >
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noreferrer" className="truncate hover:underline">
                    {p.name}
                  </a>
                ) : (
                  <span className="truncate">{p.name}</span>
                )}
                <form action={deleteAction.bind(null, p.id)}>
                  <button aria-label={`Remover ${p.name}`} className="flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full text-brand-700 hover:bg-brand-200 hover:text-rose-700">
                    <X className="size-3" />
                  </button>
                </form>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
