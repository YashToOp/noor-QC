"use client";

import * as React from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { ChartLegend, ChartTooltip, assignSeriesColours } from "./chart-primitives";
import { formatCount } from "@/lib/format";

/**
 * DonutChart — DESIGN_SYSTEM.md §6.3: "What's the composition?" (≤ 5 parts)
 * → donut with the total in the centre hole. Never a pie with labels around it.
 *
 * Slice colours come from the fixed-order ERP-safe palette, and the legend is
 * mandatory here because a donut is always ≥ 2 series (§6.4).
 */
export interface DonutSlice {
  name: string;
  value: number;
  /** Pinned colour, for slices whose identity must not move (e.g. a status). */
  colour?: string;
}

export function DonutChart({
  data,
  totalLabel,
  ariaLabel,
  valueFormatter = (v) => formatCount(Number(v)),
}: {
  data: DonutSlice[];
  totalLabel: string;
  ariaLabel: string;
  valueFormatter?: (value: number | string) => string;
}) {
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());

  const palette = React.useMemo(
    () => assignSeriesColours(data.map((d) => d.name)),
    [data],
  );
  const coloured = data.map((d) => ({ ...d, colour: d.colour ?? palette[d.name] }));
  const visible = coloured.filter((d) => !hidden.has(d.name));
  const total = visible.reduce((sum, d) => sum + d.value, 0);

  const toggle = (name: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <div className="relative min-h-0 flex-1" role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={visible}
              dataKey="value"
              nameKey="name"
              innerRadius="62%"
              outerRadius="88%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive
              animationDuration={400}
            >
              {visible.map((d) => (
                <Cell key={d.name} fill={d.colour} />
              ))}
            </Pie>
            <Tooltip content={<ChartTooltip valueFormatter={valueFormatter} />} />
          </PieChart>
        </ResponsiveContainer>

        {/* The total lives in the centre hole (§6.3). */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="kpi text-2xl font-medium text-ink">{formatCount(total)}</span>
          <span className="text-xs text-ink-sub">{totalLabel}</span>
        </div>
      </div>

      <ChartLegend
        series={coloured.map((d) => ({ name: d.name, colour: d.colour! }))}
        hidden={hidden}
        onToggle={toggle}
      />
    </div>
  );
}
