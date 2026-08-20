"use client";

import * as React from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/**
 * Dialog — DESIGN_SYSTEM.md §5.9.
 *
 * 16px radius · shadow s5 · 440 / 560 / 720px · p-6, header pb-4, footer pt-4.
 * Scrim rgba(0,0,0,.4). Footer buttons are right-aligned with gap-2 and the
 * primary action last (§5.9).
 *
 * Focus moves into the dialog on open and returns to the opener on close, and
 * Tab is trapped inside while it is open (§8, keyboard path).
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  width = 440,
  footer,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  width?: 440 | 560 | 720;
  footer?: React.ReactNode;
  children?: React.ReactNode;
}) {
  const panelRef = React.useRef<HTMLDivElement>(null);
  const restoreRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (!open) return;
    restoreRef.current = document.activeElement as HTMLElement | null;
    panelRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      restoreRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] grid place-items-center bg-[rgba(0,0,0,0.4)] p-6">
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{ width }}
        className={cn("max-w-full rounded-xl bg-surface p-6 shadow-s5 outline-none")}
      >
        <div className="flex items-start justify-between gap-4 pb-4">
          <div className="min-w-0">
            <h2 className="text-base font-medium leading-6 text-ink">{title}</h2>
            {description && <p className="mt-1 text-xs text-ink-secondary">{description}</p>}
          </div>
          <Button variant="ghost" className="size-8 shrink-0 p-0" onClick={onClose} aria-label="Close">
            <X className="size-4" aria-hidden />
          </Button>
        </div>

        {children}

        {footer && <div className="flex items-center justify-end gap-2 pt-4">{footer}</div>}
      </div>
    </div>
  );
}
