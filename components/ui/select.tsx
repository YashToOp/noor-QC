"use client";

import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { PopoverPanel, useDismiss } from "./popover";

/**
 * Select — DESIGN_SYSTEM.md §5.6.
 *
 * Trigger matches the input spec (32px, 8px radius, 0.5px border). The menu is
 * rounded-lg with shadow s2 and p-1; items are h-8 rounded-md px-2 text-sm and
 * the selected one shows a 14px check on the right.
 */
export interface SelectOption {
  value: string;
  label: string;
}

export function Select({
  value,
  onChange,
  options,
  placeholder = "Select",
  label,
  icon,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  label?: string;
  icon?: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const close = React.useCallback(() => setOpen(false), []);
  useDismiss(open, close, [wrapRef]);

  const selected = options.find((o) => o.value === value);

  return (
    <div ref={wrapRef} className={cn("relative", className)}>
      {label && <span className="mb-1.5 block text-xs font-medium text-ink-secondary">{label}</span>}
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-8 w-full items-center gap-2 rounded-md border-hairline border-line bg-surface px-2",
          "text-sm text-ink transition-colors hover:border-line-hover",
        )}
      >
        {icon && (
          <span className="grid size-4 shrink-0 place-items-center text-ink-sub [&_svg]:size-4" aria-hidden>
            {icon}
          </span>
        )}
        <span className={cn("min-w-0 flex-1 truncate text-left", !selected && "text-ink-sub")}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown className="size-4 shrink-0 text-ink-sub" aria-hidden />
      </button>

      {open && (
        <PopoverPanel elevation="s2" className="min-w-full p-1" role="listbox">
          {options.map((o) => (
            <button
              key={o.value}
              role="option"
              aria-selected={o.value === value}
              onClick={() => {
                onChange(o.value);
                setOpen(false);
              }}
              className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm text-ink transition-colors hover:bg-item-hover"
            >
              <span className="min-w-0 flex-1 truncate">{o.label}</span>
              {o.value === value && <Check className="size-3.5 shrink-0 text-ink" aria-hidden />}
            </button>
          ))}
        </PopoverPanel>
      )}
    </div>
  );
}
