import { cn } from "@/lib/utils";

/**
 * Skeleton — DESIGN_SYSTEM.md §5.10.
 *
 * "Skeletons, not spinners, for anything with known shape." The block uses the
 * well background with a slow 1.6s shimmer, and cards keep their exact frame
 * and height so nothing reflows when data lands. The shimmer is a CSS
 * animation, so `prefers-reduced-motion` in globals.css switches it off.
 */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("relative overflow-hidden rounded-md bg-well", className)}
      aria-hidden
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.6s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/60 to-transparent" />
    </div>
  );
}

/** Body skeleton for a KPI card, at the exact final height so the row cannot shift. */
export function MetricSkeleton() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-2 rounded-lg bg-well py-4">
      <Skeleton className="h-8 w-24" />
      <Skeleton className="h-4 w-14" />
    </div>
  );
}

/** Table body skeleton — `rows` rows at the comfortable 44px row height. */
export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="flex flex-col">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex h-11 items-center gap-3 border-b border-line-divider px-3">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className={cn("h-3.5", c === 0 ? "w-32" : "flex-1")} />
          ))}
        </div>
      ))}
    </div>
  );
}
