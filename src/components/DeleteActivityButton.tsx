"use client";

import { useState } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { btnDanger, btnGhost } from "@/components/ui";

export function DeleteActivityButton({ deleteAction }: { deleteAction: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label="Excluir atividade"
          title="Excluir atividade"
          className="flex size-8 cursor-pointer items-center justify-center rounded-full text-rose-600 hover:bg-rose-50"
        >
          <X className="size-5" />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Excluir esta atividade?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600">
          Isso remove a atividade, a reserva, os pontos de interesse, as tips e a região cadastrados nela. Não dá
          pra desfazer.
        </p>
        <DialogFooter>
          <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
            Cancelar
          </button>
          <form action={deleteAction}>
            <button className={btnDanger}>Excluir</button>
          </form>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
