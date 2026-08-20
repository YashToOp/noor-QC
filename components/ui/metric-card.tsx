import { Card } from "./card";
import { DeltaBadge } from "./delta-badge";
import { cn } from "@/lib/utils";

/**
 * MetricCard — DESIGN_SYSTEM.md §5.2.
 *
 * A card whose body is one tinted well containing one huge number:
 * well rgba(57,70,91,.03) · 12px radius · 16px 0 padding · card height 234px ·
 * value 32px/500, tracking 1.92px, #172131, tabular-nums.
 *
 * The number is never coloured — the delta badge carries the sentiment (§9).
 * Per §7.3 a KPI always ships value, unit, comparison period and delta:
 * "a number with no comparison is not a KPI, it is trivia."
 */
export interface MetricCardProps {
  title: string;
  value: string;
  /** Rendered beside the number at text-sm, e.g. `%` or `orders`. */
  unit?: string;
  /** Percentage change against `comparison`. */
  delta?: number;
  /** When true a rise is bad — value at risk, defect rate, ageing. */
  invert?: boolean;
  /** The comparison period, spelled out under the number. */
  comparison?: string;
  className?: string;
}

export function MetricCard({
  title,
  value,
  unit,
  delta,
  invert,
  comparison,
  className,
}: MetricCardProps) {
  return (
    <Card title={title} className={cn("h-[234px]", className)}>
      <div className="flex h-full flex-col items-center justify-center rounded-lg bg-well py-4">
        <div className="flex items-baseline justify-center gap-2">
          <span className="kpi text-[32px] font-medium leading-none tracking-[1.92px] text-ink">
            {value}
          </span>
          {unit && <span className="text-sm text-ink-sub">{unit}</span>}
        </div>
        {delta !== undefined && <DeltaBadge value={delta} invert={invert} className="mt-2" />}
        {comparison && (
          <span className="mt-2 text-xs text-ink-secondary">{comparison}</span>
        )}
      </div>
    </Card>
  );
}
