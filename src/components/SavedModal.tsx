"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { btnPrimary } from "@/components/ui";

/**
 * Confirma visualmente que algo foi salvo, sem tirar o cliente da tela de edição.
 * `show` só é lido no primeiro render: o componente precisa ser remontado (via
 * `key` no pai, trocando a cada navegação) sempre que `show` for true de novo.
 */
export function SavedModal({
  show,
  title,
  body,
  cleanUrl,
}: {
  show: boolean;
  title: string;
  body: string;
  cleanUrl: string;
}) {
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
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-600">{body}</p>
        <DialogFooter>
          <button onClick={close} className={btnPrimary}>
            OK
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
