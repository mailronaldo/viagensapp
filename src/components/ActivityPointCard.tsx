"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, Sparkles, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, Field, btnGhost, btnPrimary, inputCls } from "@/components/ui";
import { TIP_CATEGORY_LABEL } from "@/lib/labels";
import { suggestPoiAction, suggestTipAction, saveSuggestedPointsAction, type AiPoint } from "@/app/actions/ai-suggestions";

type Point = { id: string; name: string; description: string | null; url: string | null; category?: string | null };

function AiSuggestions({
  kind,
  tripId,
  itemId,
}: {
  kind: "POI" | "TIP";
  tripId: string;
  itemId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [context, setContext] = useState("");
  const [suggestions, setSuggestions] = useState<AiPoint[] | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    startTransition(async () => {
      const result =
        kind === "POI" ? await suggestPoiAction(tripId, itemId) : await suggestTipAction(tripId, itemId, context);
      if ("error" in result) {
        setError(result.error);
        setSuggestions(null);
        return;
      }
      if (result.suggestions.length === 0) {
        setError("Nenhuma sugestão encontrada. Tente de novo.");
        setSuggestions(null);
        return;
      }
      setSuggestions(result.suggestions);
      setChecked(new Set(result.suggestions.map((_, i) => i)));
    });
  }

  function discard() {
    setSuggestions(null);
    setChecked(new Set());
    setError(null);
  }

  function save() {
    if (!suggestions) return;
    const selected = suggestions.filter((_, i) => checked.has(i));
    startTransition(async () => {
      const result = await saveSuggestedPointsAction(tripId, itemId, kind, selected);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      discard();
      router.refresh();
    });
  }

  if (suggestions) {
    return (
      <div className="mb-3 rounded-lg border border-brand-200 bg-brand-50/50 p-3">
        <p className="mb-2 text-xs font-medium text-brand-900">Sugestões da IA — marque as que quer manter</p>
        <ul className="mb-3 space-y-2">
          {suggestions.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={checked.has(i)}
                onChange={(e) =>
                  setChecked((prev) => {
                    const next = new Set(prev);
                    if (e.target.checked) next.add(i);
                    else next.delete(i);
                    return next;
                  })
                }
                className="mt-1"
              />
              <span className="min-w-0">
                <span className="font-medium">
                  {s.category && <span className="mr-1 text-xs text-slate-500">[{TIP_CATEGORY_LABEL[s.category as keyof typeof TIP_CATEGORY_LABEL] ?? s.category}]</span>}
                  {s.name}
                </span>
                {s.description && <span className="block text-xs text-slate-500">{s.description}</span>}
              </span>
            </li>
          ))}
        </ul>
        {error && <p className="mb-2 text-xs text-rose-700">{error}</p>}
        <div className="flex gap-2">
          <button type="button" onClick={save} disabled={pending || checked.size === 0} className={`${btnPrimary} text-xs`}>
            {pending ? "Salvando…" : `Salvar selecionadas (${checked.size})`}
          </button>
          <button type="button" onClick={discard} disabled={pending} className={`${btnGhost} text-xs`}>
            Descartar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-3">
      {kind === "TIP" && (
        <input
          value={context}
          onChange={(e) => setContext(e.target.value)}
          placeholder="O que você procura? Ex.: comida local, vida noturna, compras…"
          className={`${inputCls} mb-2 text-sm`}
        />
      )}
      <button
        type="button"
        onClick={load}
        disabled={pending || (kind === "TIP" && !context.trim())}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Sparkles className="size-3.5" />
        {pending ? "Buscando…" : kind === "POI" ? "Carregar sugestões com IA" : "Buscar dicas com IA"}
      </button>
      {error && <p className="mt-2 text-xs text-rose-700">{error}</p>}
    </div>
  );
}

export function ActivityPointCard({
  title,
  hint,
  items,
  addAction,
  deleteAction,
  showCategory,
  ai,
}: {
  title: string;
  hint?: string;
  items: Point[];
  /** Server action já vinculada a (tripId, itemId, kind) — falta só o FormData do modal. */
  addAction: (formData: FormData) => void;
  /** Server action já vinculada a (tripId, itemId) — falta só o id do ponto. */
  deleteAction: (pointId: string) => void;
  /** Mostra o seletor de categoria no diálogo de adicionar (usado nas Tips). */
  showCategory?: boolean;
  /** Presente = card ganha a seção de sugestões de IA. */
  ai?: { kind: "POI" | "TIP"; tripId: string; itemId: string };
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
              {showCategory && (
                <Field label="Categoria">
                  <select name="category" defaultValue="" className={inputCls}>
                    <option value="">—</option>
                    {Object.entries(TIP_CATEGORY_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
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
      {ai && <AiSuggestions kind={ai.kind} tripId={ai.tripId} itemId={ai.itemId} />}
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">Nada cadastrado ainda.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((p) => {
            const chip = (
              <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand-50 py-1 ps-3 pe-1.5 text-xs text-brand-900">
                {p.category && (
                  <span className="text-[10px] uppercase text-brand-600">
                    {TIP_CATEGORY_LABEL[p.category as keyof typeof TIP_CATEGORY_LABEL] ?? p.category}:
                  </span>
                )}
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
            );
            return (
              <li key={p.id}>
                {p.description ? (
                  <Tooltip>
                    <TooltipTrigger asChild>{chip}</TooltipTrigger>
                    <TooltipContent className="max-w-56">{p.description}</TooltipContent>
                  </Tooltip>
                ) : (
                  chip
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
