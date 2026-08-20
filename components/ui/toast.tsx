"use client";

import * as React from "react";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Toast — DESIGN_SYSTEM.md §5.9.
 * 12px radius · shadow s3 · 360px · p-3 · bottom-right stack · gap-2.
 *
 * §5.10 is strict about what belongs here: toasts report the outcome of *user
 * actions*. A failed data fetch is an error state inside the card, never a
 * toast. Both tones carry an icon and a word, so neither is colour-alone (§8).
 */
export type ToastTone = "success" | "error";

export interface ToastMessage {
  id: number;
  tone: ToastTone;
  title: string;
  description?: string;
}

const ToastContext = React.createContext<(t: Omit<ToastMessage, "id">) => void>(() => {});

export function useToast() {
  return React.useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastMessage[]>([]);
  const seq = React.useRef(0);

  const push = React.useCallback((t: Omit<ToastMessage, "id">) => {
    const id = ++seq.current;
    setItems((prev) => [...prev, { ...t, id }]);
    setTimeout(() => setItems((prev) => prev.filter((i) => i.id !== id)), 6000);
  }, []);

  const dismiss = (id: number) => setItems((prev) => prev.filter((i) => i.id !== id));

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[200] flex flex-col gap-2"
        role="region"
        aria-label="Notifications"
      >
        {items.map((t) => (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            className={cn(
              "pointer-events-auto flex w-[360px] items-start gap-2 rounded-lg border-hairline border-line",
              "bg-surface p-3 shadow-s3 animate-[toast-in_160ms_ease-out]",
            )}
          >
            <span className="mt-0.5 shrink-0" aria-hidden>
              {t.tone === "success" ? (
                <CheckCircle2 className="size-4 text-state-success" />
              ) : (
                <AlertCircle className="size-4 text-[#f54a45]" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 text-xs text-ink-secondary">{t.description}</p>
              )}
            </div>
            <button
              onClick={() => dismiss(t.id)}
              aria-label="Dismiss"
              className="grid size-5 shrink-0 place-items-center rounded-sm text-ink-sub transition-colors hover:bg-item-hover hover:text-ink"
            >
              <X className="size-3.5" aria-hidden />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
