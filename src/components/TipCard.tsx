"use client";

import { useState } from "react";
import { ArrowLeft, Pencil } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ConfirmDeleteButton } from "@/components/ConfirmDeleteButton";
import { TipFormFields } from "@/components/TipFormFields";
import { Tag, btnPrimary } from "@/components/ui";
import { googleMapsSearchUrl } from "@/lib/maps";

type Tip = {
  id: string;
  name: string;
  description: string | null;
  neighborhoodId: string | null;
  neighborhoodName: string | null;
  cityName: string | null;
  categories: { id: string; name: string }[];
};

export function TipCard({
  tip,
  neighborhoods,
  cities,
  categories,
  updateAction,
  deleteAction,
}: {
  tip: Tip;
  neighborhoods: { id: string; name: string; cityId: string; cityName: string }[];
  cities: { id: string; name: string }[];
  categories: { id: string; name: string }[];
  updateAction: (formData: FormData) => void;
  deleteAction: () => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="min-w-0 rounded-lg border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <a
            href={googleMapsSearchUrl([tip.name, tip.neighborhoodName, tip.cityName])}
            target="_blank"
            rel="noreferrer"
            className="block truncate text-sm font-medium hover:underline"
          >
            {tip.name}
          </a>
          <p className="truncate text-xs text-slate-500">{[tip.cityName, tip.neighborhoodName].filter(Boolean).join(" · ") || "Sem cidade"}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {tip.categories.map((c) => (
              <Tag key={c.id} tone="neutral">
                {c.name}
              </Tag>
            ))}
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label="Editar dica"
              title="Editar dica"
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 hover:text-brand-700"
            >
              <Pencil className="size-4" />
            </button>
          </DialogTrigger>
          <DialogContent showCloseButton={false}>
            <div className="mb-5 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Voltar"
                title="Voltar"
                className="flex size-8 cursor-pointer items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
              >
                <ArrowLeft className="size-5" />
              </button>
              <DialogTitle>Editar dica</DialogTitle>
              <ConfirmDeleteButton
                label="Excluir dica"
                confirmTitle="Excluir esta dica?"
                confirmDescription="Só é possível excluir se nenhuma atividade estiver usando essa dica."
                deleteAction={deleteAction}
              />
            </div>
            <form action={updateAction} className="grid gap-3 sm:grid-cols-6">
              <TipFormFields neighborhoods={neighborhoods} cities={cities} categories={categories} tip={tip} />
              <div className="sm:col-span-6">
                <button className={btnPrimary}>Salvar dica</button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
