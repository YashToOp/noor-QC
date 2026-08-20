"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Tabs — DESIGN_SYSTEM.md §4.4.
 *
 * Strip height 40px, active underline 1.8px solid #172131 pulled down by -1px
 * to sit on the container's border, label 14px/500 with -0.084px tracking,
 * idle #8793a3. The hover background is a 6px pill on the *label*, not the
 * whole tab.
 */
export interface TabDef {
  id: string;
  label: string;
  icon?: React.ReactNode;
  /** Rendered as a count after the label — never a colour-only signal. */
  count?: number;
}

export function Tabs({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: TabDef[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}) {
  return (
    <nav
      role="tablist"
      className={cn("flex items-center gap-4 border-b border-line-soft", className)}
    >
      {tabs.map((t) => {
        const isActive = active === t.id;
        return (
          <button
            key={t.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(t.id)}
            className={cn(
              "-mb-px inline-flex h-10 items-center whitespace-nowrap border-b-[1.8px] px-0 text-sm tracking-[-0.084px] transition-colors",
              isActive
                ? "border-line-selected font-medium text-ink"
                : "border-transparent font-normal text-ink-sub hover:text-ink-secondary",
            )}
          >
            <span className="flex items-center gap-1.5 rounded-sm px-1 hover:bg-item-hover">
              {t.icon && <span className="grid size-4 place-items-center [&_svg]:size-4">{t.icon}</span>}
              {t.label}
              {t.count !== undefined && (
                <span className="tabular-nums text-ink-sub">({t.count})</span>
              )}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
