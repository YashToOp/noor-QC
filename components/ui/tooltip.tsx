"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Tooltip — DESIGN_SYSTEM.md §5.9.
 * 6px radius · no shadow · px-2 py-1 · bg #222331 · white 12px.
 *
 * Opens on hover *and* on focus, so it is reachable from the keyboard (§8).
 */
export function Tooltip({
  label,
  children,
  side = "top",
}: {
  label: string;
  children: React.ReactElement;
  side?: "top" | "bottom";
}) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();

  return (
    <span
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {React.cloneElement(children, { "aria-describedby": open ? id : undefined } as never)}
      {open && (
        <span
          id={id}
          role="tooltip"
          className={cn(
            "pointer-events-none absolute left-1/2 z-50 -translate-x-1/2 whitespace-nowrap",
            "rounded-sm bg-[#222331] px-2 py-1 text-xs text-white",
            side === "top" ? "bottom-[calc(100%+4px)]" : "top-[calc(100%+4px)]",
          )}
        >
          {label}
        </span>
      )}
    </span>
  );
}
