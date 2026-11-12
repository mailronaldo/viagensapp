"use client";

import { useState, useTransition } from "react";
import { ChevronDown, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { inputCls, btnOutline, btnPrimary } from "@/components/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Command, CommandCheck, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { createNeighborhoodInlineAction } from "@/app/actions/cities";

export type NeighborhoodOption = { id: string; name: string; cityId: string; cityName: string };

/**
 * Select de bairro/região com busca (digita e filtra) e um "+" ao lado pra
 * cadastrar um bairro novo sem saber da tela — direto num modal, sem navegar
 * pro gestor de cidades.
 */
export function NeighborhoodSelect({
  neighborhoods,
  cities,
  defaultValue = "",
  name = "neighborhoodId",
  required = false,
}: {
  neighborhoods: NeighborhoodOption[];
  cities: { id: string; name: string }[];
  defaultValue?: string;
  name?: string;
  required?: boolean;
}) {
  const [options, setOptions] = useState(neighborhoods);
  const [value, setValue] = useState(defaultValue);
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCityId, setNewCityId] = useState(cities[0]?.id ?? "");
  const [modalError, setModalError] = useState("");
  const [pending, startTransition] = useTransition();

  const byCity = new Map<string, NeighborhoodOption[]>();
  for (const n of options) {
    const list = byCity.get(n.cityName) ?? [];
    list.push(n);
    byCity.set(n.cityName, list);
  }
  const selected = options.find((o) => o.id === value);

  function submitNew() {
    const trimmed = newName.trim();
    if (!trimmed || !newCityId) return;
    setModalError("");
    startTransition(async () => {
      const result = await createNeighborhoodInlineAction(newCityId, trimmed);
      if ("error" in result) {
        setModalError(result.error);
        return;
      }
      setOptions((prev) => [...prev, result]);
      setValue(result.id);
      setNewName("");
      setModalOpen(false);
    });
  }

  return (
    <div className="flex items-stretch gap-2">
      <input type="hidden" name={name} value={value} required={required} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(inputCls, "flex flex-1 items-center justify-between gap-2 text-left", !selected && "text-slate-400")}
          >
            <span className="truncate">{selected ? `${selected.name} — ${selected.cityName}` : required ? "Selecione…" : "—"}</span>
            <ChevronDown className="size-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command>
            <CommandInput placeholder="Buscar bairro/região…" />
            <CommandList>
              <CommandEmpty>Nada encontrado.</CommandEmpty>
              {!required && (
                <CommandItem
                  value="—"
                  onSelect={() => {
                    setValue("");
                    setOpen(false);
                  }}
                >
                  —{value === "" && <CommandCheck />}
                </CommandItem>
              )}
              {[...byCity.entries()].map(([cityLabel, items]) => (
                <CommandGroup key={cityLabel} heading={cityLabel}>
                  {items.map((n) => (
                    <CommandItem
                      key={n.id}
                      value={`${n.name} ${cityLabel}`}
                      onSelect={() => {
                        setValue(n.id);
                        setOpen(false);
                      }}
                    >
                      {n.name}
                      {n.id === value && <CommandCheck />}
                    </CommandItem>
                  ))}
                </CommandGroup>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog
        open={modalOpen}
        onOpenChange={(v) => {
          setModalOpen(v);
          if (v) setModalError("");
        }}
      >
        <DialogTrigger asChild>
          <button type="button" title="Cadastrar novo bairro/região" aria-label="Cadastrar novo bairro/região" className={cn(btnOutline, "px-3")}>
            <Plus className="size-4" />
          </button>
        </DialogTrigger>
        <DialogContent>
          <DialogTitle>Novo bairro/região</DialogTitle>
          {modalError && <p className="mt-2 text-sm text-rose-600">{modalError}</p>}
          <div className="mt-3 grid gap-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Cidade</span>
              <select value={newCityId} onChange={(e) => setNewCityId(e.target.value)} className={inputCls}>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-slate-600">Nome</span>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className={inputCls}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitNew();
                  }
                }}
              />
            </label>
            <button type="button" onClick={submitNew} disabled={pending || !newCityId} className={btnPrimary}>
              {pending ? "Salvando…" : "Salvar"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
