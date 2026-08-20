"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { PopoverPanel, useDismiss } from "./popover";

/**
 * DropdownMenu — DESIGN_SYSTEM.md §5.9.
 * 12px radius · shadow s2 · min-w-[200px] · p-1 · items h-8 rounded-md px-2 text-sm.
 */
export interface MenuItem {
  label: string;
  onSelect: () => void;
  icon?: React.ReactNode;
  destructive?: boolean;
  disabled?: boolean;
}

export function DropdownMenu({
  trigger,
  items,
  align = "end",
  label = "Open menu",
}: {
  trigger: React.ReactElement;
  items: MenuItem[];
  align?: "start" | "end";
  label?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const close = React.useCallback(() => setOpen(false), []);
  useDismiss(open, close, [wrapRef]);

  return (
    <div ref={wrapRef} className="relative">
      {React.cloneElement(trigger, {
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          setOpen((v) => !v);
        },
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-label": label,
      } as React.HTMLAttributes<HTMLElement>)}

      {open && (
        <PopoverPanel align={align} elevation="s2" className="min-w-[200px] p-1" role="menu">
          {items.map((item) => (
            <button
              key={item.label}
              role="menuitem"
              disabled={item.disabled}
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
                item.onSelect();
              }}
              className={cn(
                "flex h-8 w-full items-center gap-2 rounded-md px-2 text-left text-sm transition-colors",
                item.destructive ? "text-[#f54a45]" : "text-ink",
                item.disabled ? "pointer-events-none opacity-50" : "hover:bg-item-hover",
              )}
            >
              {item.icon && (
                <span className="grid size-4 shrink-0 place-items-center text-ink-sub [&_svg]:size-4">
                  {item.icon}
                </span>
              )}
              {item.label}
            </button>
          ))}
        </PopoverPanel>
      )}
    </div>
  );
}
