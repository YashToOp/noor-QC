"use client";

import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS_PROPS, CHART_MARGIN, ChartTooltip, GRID_PROPS } from "./chart-primitives";
import { compact } from "@/lib/format";

/**
 * TrendChart — DESIGN_SYSTEM.md §6.4, the reference implementation.
 *
 * Single series, so: #6895ff at strokeWidth 2, dot={false}, activeDot r=4, a
 * vertical gradient 25% → 5%, and **no legend** — the card title already names
 * the series (§6.4).
 */
export interface TrendPoint {
  label: string;
  value: number;
}

export function TrendChart({
  data,
  name,
  valueFormatter = (v) => String(v),
  ariaLabel,
}: {
  data: TrendPoint[];
  name: string;
  valueFormatter?: (value: number | string) => string;
  ariaLabel: string;
}) {
  return (
    <div className="h-full w-full" role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={CHART_MARGIN}>
          <defs>
            <linearGradient id="fill-primary" x1="0" y1="0" x2="0" y2="1">
              <stop offset="20%" stopColor="var(--chart-primary)" stopOpacity={0.25} />
              <stop offset="100%" stopColor="var(--chart-primary)" stopOpacity={0.05} />
            </linearGradient>
          </defs>

          <CartesianGrid {...GRID_PROPS} />

          <XAxis dataKey="label" {...AXIS_PROPS} tickMargin={12} minTickGap={40} />
          <YAxis width={40} {...AXIS_PROPS} tickFormatter={compact} allowDecimals={false} />

          <Tooltip
            cursor={{ stroke: "var(--chart-grid)", strokeDasharray: "3 3" }}
            content={<ChartTooltip valueFormatter={valueFormatter} />}
          />

          <Area
            type="monotone"
            dataKey="value"
            name={name}
            stroke="var(--chart-primary)"
            strokeWidth={2}
            fill="url(#fill-primary)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
            isAnimationActive
            animationDuration={400}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
