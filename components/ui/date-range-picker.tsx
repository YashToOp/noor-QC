"use client";

import * as React from "react";
import { Calendar } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/format";
import { PopoverPanel, useDismiss } from "./popover";

/**
 * DateRangePicker — DESIGN_SYSTEM.md §5.6.
 *
 * A secondary button showing `CalendarIcon + "Jul 24 - Aug 20, 2026"`, opening
 * a popover at shadow s3 with a left rail of presets. §5.6 makes `This FY` and
 * `Last FY` mandatory for an ERP, with the fiscal year start coming from
 * company settings rather than January — Noor's books run April–March, so
 * that is the start used here.
 */
export interface DateRange {
  from: Date;
  to: Date;
}

export const FISCAL_YEAR_START_MONTH = 3; // April, zero-indexed.

export type PresetKey =
  | "today"
  | "last7"
  | "last30"
  | "month"
  | "quarter"
  | "fy"
  | "lastFy";

const PRESET_LABEL: Record<PresetKey, string> = {
  today: "Today",
  last7: "Last 7 days",
  last30: "Last 30 days",
  month: "This month",
  quarter: "This quarter",
  fy: "This FY",
  lastFy: "Last FY",
};

export function resolvePreset(key: PresetKey, now = new Date()): DateRange {
  const to = endOfDay(now);
  switch (key) {
    case "today":
      return { from: startOfDay(now), to };
    case "last7":
      return { from: startOfDay(addDays(now, -6)), to };
    case "last30":
      return { from: startOfDay(addDays(now, -29)), to };
    case "month":
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to };
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3) * 3;
      return { from: new Date(now.getFullYear(), q, 1), to };
    }
    case "fy":
      return { from: fiscalYearStart(now), to };
    case "lastFy": {
      const start = fiscalYearStart(now);
      const prev = new Date(start);
      prev.setFullYear(prev.getFullYear() - 1);
      return { from: prev, to: endOfDay(addDays(start, -1)) };
    }
  }
}

function fiscalYearStart(now: Date): Date {
  const year = now.getMonth() >= FISCAL_YEAR_START_MONTH ? now.getFullYear() : now.getFullYear() - 1;
  return new Date(year, FISCAL_YEAR_START_MONTH, 1);
}
function startOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function endOfDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}
function addDays(d: Date, n: number) {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

export function DateRangePicker({
  value,
  preset,
  onChange,
}: {
  value: DateRange;
  preset: PresetKey;
  onChange: (range: DateRange, preset: PresetKey) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const close = React.useCallback(() => setOpen(false), []);
  useDismiss(open, close, [wrapRef]);

  const label = `${formatDate(value.from)} – ${formatDate(value.to)}`;

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "inline-flex h-8 items-center gap-2 rounded-md border-hairline border-line bg-surface px-2",
          "text-sm text-ink transition-colors hover:border-line-hover hover:bg-item-hover",
        )}
      >
        <Calendar className="size-4 shrink-0 text-ink-sub" aria-hidden />
        <span className="tabular-nums">{label}</span>
      </button>

      {open && (
        <PopoverPanel elevation="s3" className="w-[220px] p-3" role="dialog" aria-label="Date range">
          <div className="flex flex-col gap-1">
            {(Object.keys(PRESET_LABEL) as PresetKey[]).map((key) => (
              <button
                key={key}
                onClick={() => {
                  onChange(resolvePreset(key), key);
                  setOpen(false);
                }}
                className={cn(
                  "flex h-8 items-center rounded-md px-2 text-left text-sm transition-colors hover:bg-item-hover",
                  key === preset ? "bg-item-active font-medium text-ink" : "text-ink-secondary",
                )}
              >
                {PRESET_LABEL[key]}
              </button>
            ))}
          </div>
        </PopoverPanel>
      )}
    </div>
  );
}
