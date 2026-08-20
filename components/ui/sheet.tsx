"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/**
 * Sheet — DESIGN_SYSTEM.md §5.9.
 *
 * Side drawer at 420 or 640px, shadow s5, p-6, with the 16px radius on the
 * **inner edge only** — the outer edge is flush with the viewport.
 */
export function Sheet({
  open,
  onClose,
  title,
  width = 420,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  width?: 420 | 640;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-[rgba(0,0,0,0.4)]">
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={{ width }}
        className={cn(
          "flex h-full max-w-full flex-col bg-surface p-6 shadow-s5",
          "rounded-l-xl", // inner edge only
        )}
      >
        <div className="flex items-start justify-between gap-4 pb-4">
          <h2 className="min-w-0 truncate text-base font-medium leading-6 text-ink">{title}</h2>
          <Button variant="ghost" className="size-8 shrink-0 p-0" onClick={onClose} aria-label="Close">
            <X className="size-4" aria-hidden />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

        {footer && <div className="flex items-center justify-end gap-2 pt-4">{footer}</div>}
      </aside>
    </div>
  );
}
