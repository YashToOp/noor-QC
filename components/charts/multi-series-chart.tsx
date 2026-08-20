"use client";

import * as React from "react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AXIS_PROPS,
  CHART_MARGIN,
  ChartLegend,
  ChartTooltip,
  GRID_PROPS,
  assignSeriesColours,
} from "./chart-primitives";
import { compact } from "@/lib/format";

/**
 * MultiSeriesChart — DESIGN_SYSTEM.md §6.1–6.4.
 *
 * Two or more series on **one shared scale**. There is deliberately no
 * secondary-axis prop: §6.3 forbids dual-axis charts outright, and two
 * measures at different scales become two charts or both indexed to 100.
 *
 * A legend is mandatory here (≥ 2 series) and the palette is the fixed-order
 * ERP-safe set from §6.2B. Clicking a legend entry toggles its series without
 * repainting the survivors — colour follows the entity, not the rank.
 */
export interface MultiSeriesPoint {
  label: string;
  [series: string]: string | number;
}

export function MultiSeriesChart({
  data,
  series,
  ariaLabel,
  valueFormatter = (v) => String(v),
}: {
  data: MultiSeriesPoint[];
  series: string[];
  ariaLabel: string;
  valueFormatter?: (value: number | string) => string;
}) {
  const [hidden, setHidden] = React.useState<Set<string>>(new Set());
  const palette = React.useMemo(() => assignSeriesColours(series), [series]);

  const toggle = (name: string) =>
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <div className="min-h-0 flex-1" role="img" aria-label={ariaLabel}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={CHART_MARGIN}>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="label" {...AXIS_PROPS} tickMargin={12} minTickGap={40} />
            <YAxis width={40} {...AXIS_PROPS} tickFormatter={compact} allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: "var(--chart-grid)", strokeDasharray: "3 3" }}
              content={<ChartTooltip valueFormatter={valueFormatter} />}
            />
            {series
              .filter((s) => !hidden.has(s))
              .map((s) => (
                <Line
                  key={s}
                  type="monotone"
                  dataKey={s}
                  name={s}
                  stroke={palette[s]}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  isAnimationActive
                  animationDuration={400}
                />
              ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      <ChartLegend
        series={series.map((s) => ({ name: s, colour: palette[s] }))}
        hidden={hidden}
        onToggle={toggle}
      />
    </div>
  );
}
