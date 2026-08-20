import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * DeltaBadge — DESIGN_SYSTEM.md §5.2.
 *
 * The badge carries the sentiment so the KPI number never has to. `invert`
 * exists because "up" is not globally good: up is bad for defect rate, ageing
 * and value at risk, and hard-coding that is the mistake §5.2 calls out.
 */
export interface DeltaBadgeProps {
  /** Percentage change against the comparison period. */
  value: number;
  /** When true, a rise is bad and a fall is good. */
  invert?: boolean;
  className?: string;
}

export function DeltaBadge({ value, invert = false, className }: DeltaBadgeProps) {
  const up = value >= 0;
  const good = invert ? !up : up;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium tabular-nums",
        good ? "bg-state-success-bg text-[#0a5c37]" : "bg-state-error-bg text-[#8c1a20]",
        className,
      )}
    >
      {up ? <ArrowUpRight className="size-3" aria-hidden /> : <ArrowDownRight className="size-3" aria-hidden />}
      {Math.abs(value).toFixed(1)}%
      <span className="sr-only">{up ? "up" : "down"} versus the previous period</span>
    </span>
  );
}
