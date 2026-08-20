"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { Select } from "./select";
import { Button } from "./button";
import { formatCount } from "@/lib/format";

/**
 * Pagination — DESIGN_SYSTEM.md §5.7.
 *
 * Sits *outside* the scroll area in an h-12 footer with a top divider:
 * `Rows per page [25 ▾]` on the left, `1–25 of 1,284` and `‹ ›` on the right,
 * all text-sm text-ink-secondary.
 */
export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
}) {
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <div className="flex h-12 items-center justify-between border-t border-line-divider px-3">
      <div className="flex items-center gap-2 text-sm text-ink-secondary">
        <span>Rows per page</span>
        <Select
          className="w-[72px]"
          value={String(pageSize)}
          onChange={(v) => onPageSizeChange(Number(v))}
          options={[10, 25, 50, 100].map((n) => ({ value: String(n), label: String(n) }))}
        />
      </div>

      <div className="flex items-center gap-2 text-sm text-ink-secondary">
        <span className="tabular-nums">
          {formatCount(first)}–{formatCount(last)} of {formatCount(total)}
        </span>
        <Button
          variant="icon"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          <ChevronLeft className="size-4" aria-hidden />
        </Button>
        <Button
          variant="icon"
          aria-label="Next page"
          disabled={page >= lastPage}
          onClick={() => onPageChange(page + 1)}
        >
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}
