"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Shared chart furniture — DESIGN_SYSTEM.md §6.1 and §6.4.
 *
 * The four things that make a chart read as "this system": dotted horizontal
 * gridlines, no axis lines, tiny grey ticks, one soft blue series with a
 * gradient fade.
 */

/** 12px, fill #737373, weight 400 (§6.1). */
export const AXIS_TICK = { fontSize: 12, fill: "var(--chart-axis)", fontWeight: 400 } as const;

/** "The card padding is the chart's margin." */
export const CHART_MARGIN = { top: 8, right: 8, bottom: 0, left: 0 } as const;

export const GRID_PROPS = {
  vertical: false,
  stroke: "var(--chart-grid)",
  strokeDasharray: "3 3",
  strokeWidth: 1,
} as const;

export const AXIS_PROPS = { axisLine: false, tickLine: false, tick: AXIS_TICK } as const;

/**
 * ERP-safe palette — §6.2B. The default for anything with ≥ 4 series.
 * Assigned in fixed order, never cycled and never hashed: slot 1 is the same
 * entity on every screen.
 */
export const ERP_SAFE = [
  "#5482f9",
  "#849505",
  "#c25ac4",
  "#37a52d",
  "#7479f7",
  "#e55055",
  "#0499bf",
  "#c07804",
] as const;

/** The 8th series is not a 9th colour — the tail aggregates into Other. */
export const OTHER_COLOUR = "#8793a3";
export const MAX_SERIES = 7;

/**
 * Rank series by value, keep the top 7, and fold the rest into `Other` (§6.2).
 * Colour follows the entity, not the rank, so the returned assignment is keyed
 * by name and stays put when a series is filtered out.
 */
export function assignSeriesColours(names: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  names.forEach((name, i) => {
    out[name] = i < ERP_SAFE.length ? ERP_SAFE[i] : OTHER_COLOUR;
  });
  return out;
}

/**
 * ChartTooltip — §6.4. Always custom, never the Recharts default.
 * "A chart with no hover layer is unfinished."
 */
export interface TooltipEntry {
  name?: string | number;
  value?: number | string;
  color?: string;
}

export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter = (v) => String(v),
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  labelFormatter?: (label: string | number) => string;
  valueFormatter?: (value: number | string) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border-hairline border-line bg-surface p-2.5 shadow-s2">
      {label !== undefined && (
        <div className="mb-1.5 text-xs text-ink-sub">
          {labelFormatter ? labelFormatter(label) : label}
        </div>
      )}
      {payload.map((p, i) => (
        <div key={`${p.name}-${i}`} className="flex items-center gap-2 text-sm">
          <span
            className="size-2 shrink-0 rounded-[2px]"
            style={{ background: p.color }}
            aria-hidden
          />
          <span className="text-ink-secondary">{p.name}</span>
          <span className="ml-auto pl-4 font-medium tabular-nums text-ink">
            {valueFormatter(p.value ?? 0)}
          </span>
        </div>
      ))}
    </div>
  );
}

/**
 * ChartLegend — §6.4. Required whenever there are ≥ 2 series, omitted for a
 * single series. Bottom-left, 12px, with an 8×8 rounded-[2px] swatch. Clicking
 * toggles the series; toggled-off entries drop to opacity-40 and keep their
 * colour. Text never wears the series colour (§6.2).
 */
export function ChartLegend({
  series,
  hidden,
  onToggle,
  className,
}: {
  series: { name: string; colour: string }[];
  hidden?: Set<string>;
  onToggle?: (name: string) => void;
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5", className)}>
      {series.map((s) => {
        const off = hidden?.has(s.name) ?? false;
        const content = (
          <>
            <span
              className="size-2 shrink-0 rounded-[2px]"
              style={{ background: s.colour }}
              aria-hidden
            />
            <span className="text-xs text-ink-secondary">{s.name}</span>
          </>
        );
        return (
          <li key={s.name} className={cn(off && "opacity-40")}>
            {onToggle ? (
              <button
                type="button"
                aria-pressed={!off}
                onClick={() => onToggle(s.name)}
                className="inline-flex items-center gap-1.5 rounded-sm"
              >
                {content}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5">{content}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
