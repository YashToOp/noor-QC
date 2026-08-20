"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * DataTable — DESIGN_SYSTEM.md §5.7, the ERP workhorse.
 *
 * Header h-9 on #f5f5fa, sticky, 1px rgba(57,70,91,.15) beneath. Body rows
 * h-11 with the same divider, hover #f5f5fa, selected rgba(57,70,91,.05) plus
 * a 2px inset bar in #172131. No zebra striping — dividers only. Cells are
 * px-3 and 14px/400 #606a78; the primary identifier column is 14px/500
 * #172131. Numeric cells are right-aligned and tabular.
 *
 * Real table semantics per §8: a visually-hidden <caption>, scope="col" on
 * every header, and aria-sort on the sorted one. Rows are keyboard-reachable
 * and Enter opens the record.
 */
export type Align = "left" | "right";

export interface Column<T> {
  id: string;
  header: string;
  /** Right-aligns the column and switches it to tabular figures. */
  numeric?: boolean;
  /** Renders at 14px/500 #172131 — exactly one column per table. */
  primary?: boolean;
  /** Omit to make the column unsortable. */
  sortValue?: (row: T) => string | number;
  render: (row: T) => React.ReactNode;
  width?: string;
  /** The trailing w-10 actions column: reveals only on row hover. */
  actions?: boolean;
}

export interface DataTableProps<T> {
  /** Visually hidden, but required — it is the table's accessible name. */
  caption: string;
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  /** Column id to sort by on first render. */
  defaultSort?: { columnId: string; direction: SortDirection };
  /** Rendered inside the table body when there are no rows. */
  empty?: React.ReactNode;
  className?: string;
}

export type SortDirection = "asc" | "desc";

export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  onRowClick,
  selectedKey,
  defaultSort,
  empty,
  className,
}: DataTableProps<T>) {
  const [sort, setSort] = React.useState<{ columnId: string; direction: SortDirection } | null>(
    defaultSort ?? null,
  );

  const sorted = React.useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.id === sort.columnId);
    if (!col?.sortValue) return rows;
    const dir = sort.direction === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const va = col.sortValue!(a);
      const vb = col.sortValue!(b);
      if (va === vb) return 0;
      return (va < vb ? -1 : 1) * dir;
    });
  }, [rows, sort, columns]);

  const toggleSort = (col: Column<T>) => {
    if (!col.sortValue) return;
    setSort((prev) =>
      prev?.columnId === col.id
        ? { columnId: col.id, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { columnId: col.id, direction: "asc" },
    );
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border-hairline border-line bg-surface",
        className,
      )}
    >
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr className="h-9 border-b border-line-divider bg-canvas">
              {columns.map((col) => {
                const isSorted = sort?.columnId === col.id;
                const ariaSort = isSorted
                  ? sort!.direction === "asc"
                    ? "ascending"
                    : "descending"
                  : col.sortValue
                    ? "none"
                    : undefined;
                return (
                  <th
                    key={col.id}
                    scope="col"
                    aria-sort={ariaSort}
                    style={col.width ? { width: col.width } : undefined}
                    className={cn(
                      "px-3 text-xs font-medium text-ink-secondary",
                      col.numeric && "text-right",
                      col.actions && "w-10",
                    )}
                  >
                    {col.actions ? (
                      <span className="sr-only">{col.header}</span>
                    ) : col.sortValue ? (
                      <button
                        type="button"
                        onClick={() => toggleSort(col)}
                        className={cn(
                          "group inline-flex items-center gap-1 rounded-sm",
                          col.numeric && "flex-row-reverse",
                        )}
                      >
                        {col.header}
                        {isSorted ? (
                          sort!.direction === "asc" ? (
                            <ChevronUp className="size-3 text-ink" aria-hidden />
                          ) : (
                            <ChevronDown className="size-3 text-ink" aria-hidden />
                          )
                        ) : (
                          <ChevronsUpDown
                            className="size-3 text-ink-sub opacity-0 transition-opacity group-hover:opacity-100"
                            aria-hidden
                          />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={columns.length} className="p-0">
                  {empty}
                </td>
              </tr>
            ) : (
              sorted.map((row) => {
                const key = rowKey(row);
                const isSelected = selectedKey === key;
                return (
                  <tr
                    key={key}
                    tabIndex={onRowClick ? 0 : undefined}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={
                      onRowClick
                        ? (e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              onRowClick(row);
                            }
                          }
                        : undefined
                    }
                    className={cn(
                      "group relative h-11 border-b border-line-divider transition-colors last:border-b-0",
                      onRowClick && "cursor-pointer",
                      isSelected ? "bg-item-active" : "hover:bg-item-hover",
                    )}
                  >
                    {columns.map((col, i) => (
                      <td
                        key={col.id}
                        className={cn(
                          "relative px-3 align-middle text-sm",
                          col.primary ? "font-medium text-ink" : "font-normal text-ink-secondary",
                          col.numeric && "text-right tabular-nums",
                          col.actions && "w-10",
                        )}
                      >
                        {/* Selected-row inset bar — 2px, #172131, first cell only. */}
                        {isSelected && i === 0 && (
                          <span
                            className="absolute inset-y-0 left-0 w-0.5 bg-[#172131]"
                            aria-hidden
                          />
                        )}
                        {col.actions ? (
                          <span className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                            {col.render(row)}
                          </span>
                        ) : (
                          col.render(row)
                        )}
                      </td>
                    ))}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** The `—` in #cacfd8 that §5.7 reserves for an empty cell. Zero is never this. */
export function EmptyCell() {
  return <span className="text-ink-disabled">—</span>;
}
