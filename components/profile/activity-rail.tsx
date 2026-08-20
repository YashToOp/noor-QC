"use client";

import Link from "next/link";
import { EmptyState } from "@/components/ui/empty-state";
import { History } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { ActivityEntry } from "@/lib/profile";
import { cn } from "@/lib/utils";

/**
 * ActivityRail — DESIGN_SYSTEM.md §7.6's audit trail: a 1px #d5d5e8 rail, 8px
 * dots, 12px #8793a3 timestamps, 14px #172131 actor and action.
 *
 * The `events` table exists and is empty, so this rail is reconstructed from
 * the timestamps the system actually keeps — orders, stages, issues, invoices,
 * payments — with real audit rows merged in if anything ever writes them. The
 * source chip on each line says which subsystem it came from, so nothing here
 * reads as a log entry that does not exist.
 */
export function ActivityRail({ entries }: { entries: ActivityEntry[] }) {
  if (!entries.length) {
    return (
      <EmptyState
        icon={<History />}
        title="Nothing recorded yet"
        description="Activity appears here as orders move, stages complete, issues are raised and money changes hands."
      />
    );
  }

  return (
    <ol className="flex flex-col">
      {entries.map((entry, i) => {
        const last = i === entries.length - 1;
        const body = (
          <>
            <div className="flex items-start justify-between gap-3">
              <span className="min-w-0 text-sm text-ink">{entry.title}</span>
              <span className="shrink-0 text-xs tabular-nums text-ink-sub">
                {formatDateTime(entry.at)}
              </span>
            </div>
            {entry.detail && (
              <p className="mt-0.5 truncate text-xs text-ink-secondary">{entry.detail}</p>
            )}
            <span className="mt-1 inline-flex h-5 items-center rounded-sm bg-well px-1.5 text-xs font-medium text-ink-secondary">
              {entry.source}
            </span>
          </>
        );

        return (
          <li key={entry.id} className="flex gap-3">
            <div className="flex w-2 shrink-0 flex-col items-center">
              <span className="mt-1.5 size-2 shrink-0 rounded-full bg-line-hover" aria-hidden />
              {!last && <span className="w-px flex-1 bg-line" aria-hidden />}
            </div>
            <div className={cn("min-w-0 flex-1", !last && "pb-4")}>
              {entry.href ? (
                <Link href={entry.href} className="block rounded-md hover:opacity-80">
                  {body}
                </Link>
              ) : (
                body
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
