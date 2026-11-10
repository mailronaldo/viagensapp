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
import { Card, CategoryOptions, Field, btnGhost, btnPrimary, inputCls } from "@/components/ui";
import { TIP_COST_LABEL } from "@/lib/labels";
import { suggestTipsAction, saveSuggestedTipsAction, type AiPoint } from "@/app/actions/ai-suggestions";

type Tip = {
  id: string;
  name: string;
  description: string | null;
  url: string | null;
  cost: string | null;
  categoryName: string | null;
};

function AiSuggestions({ tripId, itemId }: { tripId: string; itemId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"POI" | "TEMA" | null>(null);
  const [context, setContext] = useState("");
  const [suggestions, setSuggestions] = useState<AiPoint[] | null>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);

  function load(m: "POI" | "TEMA") {
    setMode(m);
    setError(null);
    startTransition(async () => {
      const result = await suggestTipsAction(tripId, itemId, m, context);
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
    setMode(null);
  }

  function save() {
    if (!suggestions) return;
    const selected = suggestions.filter((_, i) => checked.has(i));
    startTransition(async () => {
      const result = await saveSuggestedTipsAction(tripId, itemId, selected);
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
                  {s.category && <span className="mr-1 text-xs text-slate-500">[{s.category}]</span>}
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
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => load("POI")}
        disabled={pending}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Sparkles className="size-3.5" />
        {pending && mode === "POI" ? "Buscando…" : "Carregar sugestões de pontos de interesse"}
      </button>
      <input
        value={context}
        onChange={(e) => setContext(e.target.value)}
        placeholder="O que você procura? Ex.: comida local, vida noturna, compras…"
        className={`${inputCls} w-64 text-sm`}
      />
      <button
        type="button"
        onClick={() => load("TEMA")}
        disabled={pending || !context.trim()}
        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-brand-200 bg-white px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Sparkles className="size-3.5" />
        {pending && mode === "TEMA" ? "Buscando…" : "Buscar dicas por tema"}
      </button>
      {error && <p className="w-full text-xs text-rose-700">{error}</p>}
    </div>
  );
}

export function ActivityTipsCard({
  tripId,
  itemId,
  items,
  existingTips,
  categories,
  hasCity,
  hasNeighborhood,
  linkAction,
  createAction,
  unlinkAction,
}: {
  tripId: string;
  itemId: string;
  items: Tip[];
  /** Dicas já cadastradas na mesma cidade, pra reaproveitar em vez de criar de novo. */
  existingTips: Tip[];
  categories: { id: string; name: string }[];
  /** Se a atividade tem Cidade definida (dica criada aqui herda isso). */
  hasCity: boolean;
  /** Se a atividade tem Bairro/Região definido (dica criada aqui herda isso). */
  hasNeighborhood: boolean;
  /** Server action já vinculada a (tripId, itemId) — falta só o FormData (campo `tipId`). */
  linkAction: (formData: FormData) => void;
  /** Server action já vinculada a (tripId, itemId) — falta só o FormData do modal. */
  createAction: (formData: FormData) => void;
  /** Server action já vinculada a (tripId, itemId) — falta só o id da dica. */
  unlinkAction: (tipId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"existing" | "new">(existingTips.length > 0 ? "existing" : "new");
  const linkedIds = new Set(items.map((i) => i.id));
  const availableExisting = existingTips.filter((e) => !linkedIds.has(e.id));

  return (
    <Card>
      <div className="mb-1 flex items-center justify-between">
        <h3 className="font-medium">Dicas</h3>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <button
              type="button"
              aria-label="Adicionar em Dicas"
              className="flex size-7 cursor-pointer items-center justify-center rounded-full bg-brand-50 text-brand-700 hover:bg-brand-100"
            >
              <Plus className="size-4" />
            </button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dicas</DialogTitle>
            </DialogHeader>
            <div className="mb-3 flex gap-2 text-xs">
              <button
                type="button"
                onClick={() => setMode("existing")}
                className={`rounded-full px-3 py-1 ${mode === "existing" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                Usar dica existente
              </button>
              <button
                type="button"
                onClick={() => setMode("new")}
                className={`rounded-full px-3 py-1 ${mode === "new" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"}`}
              >
                Nova dica
              </button>
            </div>
            {mode === "existing" ? (
              availableExisting.length === 0 ? (
                <p className="text-sm text-slate-500">Nenhuma outra dica cadastrada nesta cidade ainda.</p>
              ) : (
                <form action={linkAction} className="space-y-3">
                  <Field label="Dica">
                    <select name="tipId" required defaultValue="" className={inputCls}>
                      <option value="">Selecione…</option>
                      {availableExisting.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                          {e.categoryName ? ` — ${e.categoryName}` : ""}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <DialogFooter>
                    <button type="button" onClick={() => setOpen(false)} className={btnGhost}>
                      Cancelar
                    </button>
                    <button className={btnPrimary}>Vincular</button>
                  </DialogFooter>
                </form>
              )
            ) : (
              <form action={createAction} className="space-y-3">
                <Field label="Nome">
                  <input name="name" required className={inputCls} />
                </Field>
                <Field label="Categoria">
                  <select name="categoryId" defaultValue="" className={inputCls}>
                    <CategoryOptions categories={categories} />
                  </select>
                </Field>
                <Field label="Custo">
                  <select name="cost" defaultValue="" className={inputCls}>
                    <option value="">—</option>
                    {Object.entries(TIP_COST_LABEL).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
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
            )}
          </DialogContent>
        </Dialog>
      </div>
      <p className="mb-2 text-xs text-slate-500">Pontos de interesse e dicas pra essa atividade — reaproveitadas do seu repositório de Dicas.</p>
      {!hasCity ? (
        <p className="mb-2 text-xs text-amber-700">
          Esta atividade não tem Cidade definida. Defina a Cidade (no cadastro da atividade) pra que as dicas criadas aqui
          apareçam de novo em outras atividades e viagens dessa cidade.
        </p>
      ) : !hasNeighborhood ? (
        <p className="mb-2 text-xs text-amber-700">Recomendável definir também o Bairro/Região da atividade, pra uma busca de dicas mais precisa.</p>
      ) : null}
      <AiSuggestions tripId={tripId} itemId={itemId} />
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">Nada cadastrado ainda.</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {items.map((p) => {
            const chip = (
              <span className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand-50 py-1 ps-3 pe-1.5 text-xs text-brand-900">
                {p.categoryName && <span className="text-[10px] uppercase text-brand-600">{p.categoryName}:</span>}
                {p.url ? (
                  <a href={p.url} target="_blank" rel="noreferrer" className="truncate hover:underline">
                    {p.name}
                  </a>
                ) : (
                  <span className="truncate">{p.name}</span>
                )}
                {p.cost && <span className="text-[10px] text-brand-600">{TIP_COST_LABEL[p.cost as keyof typeof TIP_COST_LABEL]}</span>}
                <form action={unlinkAction.bind(null, p.id)}>
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
