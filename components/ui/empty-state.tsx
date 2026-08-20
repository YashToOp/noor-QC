import * as React from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/**
 * EmptyState — DESIGN_SYSTEM.md §5.10.
 *
 * Centred in the card or table body: a 20px #8793a3 icon in a 40px bg-well
 * rounded-lg chip, a 14px/500 #172131 line, a 12px #8793a3 explanation, then
 * one secondary button. Rhythm gap-2, block max-width 280px.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  className?: string;
}) {
  return (
    <div className={cn("flex w-full items-center justify-center py-12", className)}>
      <div className="flex max-w-[280px] flex-col items-center gap-2 text-center">
        <div
          className="grid size-10 place-items-center rounded-lg bg-well text-ink-sub [&_svg]:size-5"
          aria-hidden
        >
          {icon}
        </div>
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="text-xs text-ink-secondary">{description}</p>
        {action && (
          <Button variant="secondary" className="mt-2" onClick={action.onClick}>
            {action.label}
          </Button>
        )}
      </div>
    </div>
  );
}

/**
 * ErrorState — §5.10. Data-fetch failures live inside the card, never in a
 * toast; toasts are for the outcome of user actions only.
 */
export function ErrorState({
  thing,
  reason,
  onRetry,
}: {
  thing: string;
  reason?: string;
  onRetry: () => void;
}) {
  return (
    <div className="flex w-full items-center justify-center py-12">
      <div className="flex max-w-[280px] flex-col items-center gap-2 text-center">
        <svg
          viewBox="0 0 24 24"
          className="size-5 text-[#f54a45]"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v6M12 16.5v.5" strokeLinecap="round" />
        </svg>
        <p className="text-sm font-medium text-ink">Couldn&rsquo;t load {thing}</p>
        {reason && <p className="text-xs text-ink-secondary">{reason}</p>}
        <Button variant="ghost" className="mt-2" onClick={onRetry}>
          Retry
        </Button>
      </div>
    </div>
  );
}
