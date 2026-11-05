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

/** X vermelho com modal de confirmação antes de excluir — usado em qualquer card/painel. */
export function ConfirmDeleteButton({
  label,
  confirmTitle,
  confirmDescription,
  deleteAction,
  size = "md",
}: {
  label: string;
  confirmTitle: string;
  confirmDescription: string;
  deleteAction: () => void;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className={`flex cursor-pointer items-center justify-center rounded-full text-rose-600 hover:bg-rose-50 ${
            size === "sm" ? "size-6" : "size-8"
          }`}
        >
          <X className={size === "sm" ? "size-4" : "size-5"} />
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{confirmTitle}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600">{confirmDescription}</p>
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
