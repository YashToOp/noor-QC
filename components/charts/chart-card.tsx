"use client";

import * as React from "react";
import { MoreHorizontal, Table2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";

/**
 * ChartCard — a §5.1 Card wrapping a chart, with the `⋯` menu carrying
 * "View as table" and "Export CSV".
 *
 * §8 makes the table view non-optional: "That toggle is not optional — it is
 * the accessible equivalent of the chart." So the toggle renders a real
 * <table> from the same rows the chart was given, rather than a screenshot of
 * the numbers.
 */
export interface ChartCardRow {
  label: string;
  values: (string | number)[];
}

export function ChartCard({
  title,
  height = 398,
  rowHeaders,
  rows,
  filename,
  children,
  className,
  footer,
  defaultView = "chart",
}: {
  title: string;
  /** §4.6 card heights: 290px short, 398px standard. */
  height?: 234 | 290 | 398;
  /** Column headers for the table view and the CSV, excluding the label column. */
  rowHeaders: string[];
  /** The same data the chart is drawing, for the table view and the export. */
  rows: ChartCardRow[];
  filename: string;
  children: React.ReactNode;
  className?: string;
  footer?: React.ReactNode;
  /**
   * Open in table view. The build prompt's chart-honesty rule uses this: a
   * chart with fewer than five points looks broken, so it ships as a table
   * instead — still one card, still the same `⋯` menu, and the reader can
   * switch to the chart once there is enough data to carry one.
   */
  defaultView?: "chart" | "table";
}) {
  const [asTable, setAsTable] = React.useState(defaultView === "table");

  const exportCsv = () => {
    const header = ["", ...rowHeaders].join(",");
    const body = rows.map((r) => [r.label, ...r.values].map(csvCell).join(",")).join("\n");
    const blob = new Blob([`${header}\n${body}`], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card
      title={title}
      className={cn(className)}
      style={{ height }}
      action={
        <DropdownMenu
          label={`${title} options`}
          trigger={
            <Button variant="ghost" className="size-8 p-0">
              <MoreHorizontal className="size-4" aria-hidden />
            </Button>
          }
          items={[
            {
              label: asTable ? "View as chart" : "View as table",
              icon: <Table2 />,
              onSelect: () => setAsTable((v) => !v),
            },
            { label: "Export CSV", onSelect: exportCsv },
          ]}
        />
      }
    >
      <div className="min-h-0 flex-1">
        {asTable ? (
          rows.length === 0 ? (
            <EmptyState
              icon={<Table2 />}
              title="Nothing to show"
              description="There is no data in the selected range."
            />
          ) : (
            <div className="h-full overflow-auto">
              <table className="w-full border-collapse text-left">
                <caption className="sr-only">{title}, shown as a table</caption>
                <thead>
                  <tr className="h-9 border-b border-line-divider">
                    <th scope="col" className="px-3 text-xs font-medium text-ink-secondary">
                      &nbsp;
                    </th>
                    {rowHeaders.map((h) => (
                      <th
                        key={h}
                        scope="col"
                        className="px-3 text-right text-xs font-medium text-ink-secondary"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.label} className="h-9 border-b border-line-divider last:border-b-0">
                      <td className="px-3 text-sm font-medium text-ink">{r.label}</td>
                      {r.values.map((v, i) => (
                        <td
                          key={i}
                          className="px-3 text-right text-sm tabular-nums text-ink-secondary"
                        >
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          children
        )}
      </div>
      {footer}
    </Card>
  );
}

function csvCell(value: string | number): string {
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
