"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AXIS_PROPS, CHART_MARGIN, ChartTooltip, GRID_PROPS } from "./chart-primitives";
import { compact } from "@/lib/format";

/**
 * RankedBarChart — DESIGN_SYSTEM.md §6.3: "How do these categories compare?"
 * → horizontal bar, sorted descending. Never a pie.
 *
 * This is also the fallback the build prompt's chart-honesty rule demands: a
 * sparse line chart looks broken, so anything with fewer than five points
 * comes here instead.
 *
 * Bars are the single-series #6895ff unless a per-bar colour is supplied.
 * Values are direct-labelled at the bar end, which is the secondary encoding
 * §6.2 requires whenever colour is doing any work.
 */
export interface RankedBar {
  label: string;
  value: number;
  /** Optional per-bar colour — used only for ordinal ramps (§7.4), never decoration. */
  colour?: string;
}

export function RankedBarChart({
  data,
  name,
  valueFormatter = (v) => String(v),
  ariaLabel,
  maxLabelWidth = 92,
}: {
  data: RankedBar[];
  name: string;
  valueFormatter?: (value: number | string) => string;
  ariaLabel: string;
  maxLabelWidth?: number;
}) {
  const sorted = [...data].sort((a, b) => b.value - a.value);

  return (
    <div className="h-full w-full" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={sorted}
          layout="vertical"
          margin={{ ...CHART_MARGIN, right: 44 }}
          barCategoryGap={2}
        >
          <CartesianGrid {...GRID_PROPS} horizontal={false} vertical />

          <XAxis type="number" {...AXIS_PROPS} tickFormatter={compact} allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="label"
            width={maxLabelWidth}
            {...AXIS_PROPS}
            tickMargin={8}
          />

          <Tooltip
            cursor={{ fill: "var(--chart-bg)" }}
            content={<ChartTooltip valueFormatter={valueFormatter} />}
          />

          <Bar
            dataKey="value"
            name={name}
            radius={[0, 4, 4, 0]}
            maxBarSize={48}
            isAnimationActive
            animationDuration={400}
          >
            {sorted.map((d) => (
              <Cell key={d.label} fill={d.colour ?? "var(--chart-primary)"} />
            ))}
            <LabelList
              dataKey="value"
              position="right"
              formatter={(v: number) => valueFormatter(v)}
              style={{ fontSize: 12, fill: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
