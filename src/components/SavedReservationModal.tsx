"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { btnPrimary } from "@/components/ui";

/**
 * Confirma visualmente que a reserva foi salva, sem tirar o cliente da tela de edição.
 * `show` só é lido no primeiro render: cada navegação pra cá é uma instância nova do
 * componente (o React remonta ao mudar de página), então não precisa de efeito pra sincronizar.
 */
export function SavedReservationModal({ show, cleanUrl }: { show: boolean; cleanUrl: string }) {
  const [open, setOpen] = useState(show);
  const router = useRouter();

  function close() {
    setOpen(false);
    router.replace(cleanUrl);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reserva salva ✓</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600">Os dados da reserva foram salvos.</p>
        <DialogFooter>
          <button onClick={close} className={btnPrimary}>
            OK
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
