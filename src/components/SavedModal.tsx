"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { btnPrimary } from "@/components/ui";

const TEXT = {
  activity: { title: "Atividade salva ✓", body: "As alterações da atividade foram salvas." },
  reserva: { title: "Reserva salva ✓", body: "Os dados da reserva foram salvos." },
} as const;

/**
 * Confirma visualmente que algo foi salvo, sem tirar o cliente da tela de edição.
 * `show`/`kind` só são lidos no primeiro render: o componente é remontado (via `key`
 * no pai) a cada navegação pra cá, então não precisa de efeito pra sincronizar.
 */
export function SavedModal({ show, kind, cleanUrl }: { show: boolean; kind: keyof typeof TEXT; cleanUrl: string }) {
  const [open, setOpen] = useState(show);
  const router = useRouter();

  function close() {
    setOpen(false);
    router.replace(cleanUrl);
  }

  const text = TEXT[kind];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{text.title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600">{text.body}</p>
        <DialogFooter>
          <button onClick={close} className={btnPrimary}>
            OK
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
