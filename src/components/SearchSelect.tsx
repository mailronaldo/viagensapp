"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { inputCls } from "@/components/ui";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandCheck, CommandEmpty, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

export type SearchSelectOption = { value: string; label: string };

/** Select com busca (digita e filtra): pra listas grandes (país, estado, cidade). */
export function SearchSelect({
  name,
  required,
  value,
  onChange,
  options,
  placeholder = "Selecione…",
  searchPlaceholder = "Buscar…",
  emptyText = "Nada encontrado.",
  disabled,
}: {
  name: string;
  required?: boolean;
  value: string;
  onChange: (value: string) => void;
  options: SearchSelectOption[];
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <>
      {/* O valor de verdade pro submit do form; o combobox acima só escolhe. */}
      <input type="hidden" name={name} value={value} required={required} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className={cn(
              inputCls,
              "flex items-center justify-between gap-2 text-left disabled:cursor-not-allowed disabled:opacity-60",
              !selected && "text-slate-400",
            )}
          >
            <span className="truncate">{selected ? selected.label : placeholder}</span>
            <ChevronDown className="size-4 shrink-0 opacity-50" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <CommandList>
              <CommandEmpty>{emptyText}</CommandEmpty>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.label}
                  onSelect={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                >
                  {o.label}
                  {o.value === value && <CommandCheck />}
                </CommandItem>
              ))}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </>
  );
}
