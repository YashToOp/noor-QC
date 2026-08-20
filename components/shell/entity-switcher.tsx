"use client";

import * as React from "react";
import { ChevronsUpDown } from "lucide-react";
import { PopoverPanel, useDismiss } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * Entity switcher — DESIGN_SYSTEM.md §5.3, adapted per §7.1: for an ERP this
 * slot holds the company / legal entity and "must be permanently visible,
 * never buried in settings".
 *
 * h-14 · rounded-lg · 0.5px border · bg white · px-2 · gap-2 · 32px gradient
 * avatar with a white 14px/500 initial · "Entity" label at 12px #8793a3 ·
 * value 14px/500 #172131 · ChevronsUpDown 14px.
 *
 * Out of scope for this build: multi-tenant switching. The menu renders and is
 * keyboard-reachable, but it holds exactly one entity.
 */
export function EntitySwitcher({ name }: { name: string }) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const close = React.useCallback(() => setOpen(false), []);
  useDismiss(open, close, [wrapRef]);

  const initial = name.trim().charAt(0).toUpperCase() || "N";

  return (
    <div ref={wrapRef} className="relative px-3">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-14 w-full items-center gap-2 rounded-lg border-hairline border-line bg-surface px-2",
          "transition-colors hover:border-line-hover",
        )}
      >
        <span
          className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-[#2b3854] to-[#172131] text-sm font-medium text-white"
          aria-hidden
        >
          {initial}
        </span>
        <span className="flex min-w-0 flex-1 flex-col items-start">
          <span className="text-xs text-ink-sub">Entity</span>
          <span className="w-full truncate text-left text-sm font-medium text-ink">{name}</span>
        </span>
        <ChevronsUpDown className="size-3.5 shrink-0 text-ink-sub" aria-hidden />
      </button>

      {open && (
        <PopoverPanel
          elevation="s2"
          className="left-3 right-3 p-1"
          role="listbox"
          aria-label="Entity"
        >
          <div
            role="option"
            aria-selected
            className="flex h-8 items-center rounded-md bg-item-active px-2 text-sm font-medium text-ink"
          >
            {name}
          </div>
          <p className="px-2 py-1.5 text-xs text-ink-secondary">
            The only entity in this build.
          </p>
        </PopoverPanel>
      )}
    </div>
  );
}
