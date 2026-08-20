"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { AlertTriangle, EyeOff, Lock } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/ui/status-badge";
import { ErrorState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Stepper } from "@/components/ui/stepper";
import { useOrderDetail } from "@/lib/queries";
import { issueBadge, orderBadge, STATUS_LABEL } from "@/lib/status";
import type { StageStatus } from "@/lib/types";
import {
  formatCount,
  formatDate,
  formatDateTime,
  formatMoneyFull,
  UNKNOWN,
} from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * ORDER DETAIL — build prompt §5.4.
 *
 * The full timeline, including the internal issues the client never sees
 * (`issues.client_visible = false`). Being able to point at that distinction
 * in the demo is the whole reason it is drawn explicitly rather than filtered
 * out: an internal row is marked with a word and an icon, not a colour.
 *
 * The audit rail follows §7.6: 1px #d5d5e8 rail, 8px dots, 12px #8793a3
 * timestamps, 14px #172131 actor and action.
 */
const STAGE_LABEL: Record<StageStatus, string> = {
  pending: "Pending",
  in_progress: "In progress",
  completed: "Completed",
  blocked: "Blocked",
  skipped: "Skipped",
};

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>();
  const detail = useOrderDetail(params.id);

  if (detail.isError) {
    return (
      <>
        <PageHeader title="Order" breadcrumb={[{ label: "All orders", href: "/orders" }]} />
        <Card title="Order">
          <ErrorState
            thing="this order"
            reason={(detail.error as Error)?.message}
            onRetry={() => detail.refetch()}
          />
        </Card>
      </>
    );
  }

  if (detail.isLoading || !detail.data) {
    return (
      <>
        <PageHeader title="Order" breadcrumb={[{ label: "All orders", href: "/orders" }]} />
        <div className="grid grid-cols-12 gap-4 pt-3">
          <Card title="Timeline" className="col-span-7 h-[520px]">
            <Skeleton className="h-full w-full" />
          </Card>
          <Card title="Order" className="col-span-5 h-[520px]">
            <Skeleton className="h-full w-full" />
          </Card>
        </div>
      </>
    );
  }

  const { order, client, house, lines, events, issues, review } = detail.data;
  const totalPcs = lines.reduce((sum, l) => sum + (l.pcs ?? 0), 0);

  const steps = events.map((e) => ({
    id: e.id,
    label: e.stage?.name ?? UNKNOWN,
    state:
      e.status === "completed"
        ? ("done" as const)
        : e.status === "in_progress"
          ? ("current" as const)
          : ("pending" as const),
  }));

  return (
    <>
      <PageHeader
        title={order.number}
        breadcrumb={[{ label: "All orders", href: "/orders" }]}
        actions={<StatusBadge spec={orderBadge(order.status)} dot />}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-12 items-start gap-4 pt-3 pb-4">
          <div className="col-span-7 flex flex-col gap-4">
            <Card title="Production">
              {events.length === 0 ? (
                <p className="text-sm text-ink-secondary">
                  The stage ladder is created when this order is released. It has not been
                  released yet.
                </p>
              ) : (
                <>
                  <Stepper steps={steps} className="pt-1" />
                  <ul className="mt-2 flex flex-col">
                    {events.map((e) => (
                      <li
                        key={e.id}
                        className="flex items-center gap-3 border-b border-line-divider py-2.5 last:border-b-0"
                      >
                        <span className="min-w-0 flex-1 text-sm text-ink">
                          {e.stage?.name ?? UNKNOWN}
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-ink-secondary">
                          {e.qty_out != null
                            ? `${formatCount(e.qty_out)} out`
                            : e.qty_in != null
                              ? `${formatCount(e.qty_in)} in`
                              : UNKNOWN}
                        </span>
                        <span className="w-[104px] shrink-0 text-right text-xs tabular-nums text-ink-secondary">
                          {e.completed_at
                            ? formatDate(e.completed_at)
                            : e.expected_at
                              ? `due ${formatDate(e.expected_at)}`
                              : UNKNOWN}
                        </span>
                        <span className="w-[92px] shrink-0 text-right">
                          <span
                            className={cn(
                              "text-xs font-medium",
                              e.status === "completed"
                                ? "text-[#0a5c37]"
                                : e.status === "blocked"
                                  ? "text-[#8c1a20]"
                                  : e.status === "in_progress"
                                    ? "text-[#122368]"
                                    : "text-ink-secondary",
                            )}
                          >
                            {STAGE_LABEL[e.status]}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>

            <Card title="Timeline">
              <ol className="flex flex-col">
                {buildTimeline({ order, review, events, issues }).map((entry, i, all) => (
                  <li key={entry.id} className="flex gap-3">
                    <div className="flex w-2 shrink-0 flex-col items-center">
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-line-hover" aria-hidden />
                      {i < all.length - 1 && <span className="w-px flex-1 bg-line" aria-hidden />}
                    </div>
                    <div className={cn("min-w-0 flex-1", i < all.length - 1 && "pb-4")}>
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm text-ink">{entry.title}</span>
                        <span className="shrink-0 text-xs tabular-nums text-ink-sub">
                          {entry.at ? formatDateTime(entry.at) : UNKNOWN}
                        </span>
                      </div>
                      {entry.detail && (
                        <p className="mt-0.5 text-xs text-ink-secondary">{entry.detail}</p>
                      )}
                      {entry.internal && (
                        <span className="mt-1 inline-flex items-center gap-1 rounded-sm bg-well px-1.5 py-0.5 text-xs font-medium text-ink-secondary">
                          <Lock className="size-3" aria-hidden />
                          Internal — the client never sees this
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
          </div>

          <div className="col-span-5 flex flex-col gap-4">
            <Card title="Order">
              <dl className="flex flex-col gap-3 text-sm">
                <Row label="State" value={STATUS_LABEL[order.status]} />
                <Row label="Client" value={client?.name ?? UNKNOWN} />
                <Row label="House" value={house?.name ?? UNKNOWN} />
                <Row
                  label="Promised ship"
                  value={order.promised_ship_date ? formatDate(order.promised_ship_date) : UNKNOWN}
                />
                <Row
                  label="Expected arrival"
                  value={
                    order.expected_arrival_date ? formatDate(order.expected_arrival_date) : UNKNOWN
                  }
                />
                <Row label="Pieces" value={formatCount(totalPcs)} />
                <Row label="Total" value={formatMoneyFull(order.total, order.currency)} />
              </dl>
            </Card>

            <Card title="Lines">
              <ul className="flex flex-col gap-3">
                {lines.map((line) => (
                  <li key={line.id} className="flex items-center gap-3">
                    <span
                      className="size-8 shrink-0 rounded-md border-hairline border-line"
                      style={{ background: line.colourway?.hex ?? "var(--bg-well)" }}
                      aria-hidden
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium text-ink">
                        {line.style?.name ?? UNKNOWN}
                      </span>
                      <span className="truncate text-xs text-ink-secondary">
                        {line.colourway?.name ?? UNKNOWN}
                      </span>
                    </span>
                    <span className="shrink-0 text-sm tabular-nums text-ink">
                      {formatCount(line.pcs)} pcs
                    </span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card title="Issues">
              {issues.length === 0 ? (
                <p className="text-sm text-ink-secondary">Nothing raised against this order.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {issues.map((issue) => (
                    <li key={issue.id} className="flex items-start gap-2">
                      {issue.client_visible ? (
                        <AlertTriangle
                          className="mt-0.5 size-4 shrink-0 text-state-warning"
                          aria-hidden
                        />
                      ) : (
                        <EyeOff className="mt-0.5 size-4 shrink-0 text-ink-sub" aria-hidden />
                      )}
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="text-sm text-ink">{issue.description ?? UNKNOWN}</span>
                        <span className="flex flex-wrap items-center gap-2">
                          <StatusBadge spec={issueBadge(issue.status)} />
                          <span className="text-xs text-ink-secondary">
                            {issue.client_visible ? "Visible to the client" : "Internal only"}
                          </span>
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>
    </>
  );
}

interface TimelineEntry {
  id: string;
  title: string;
  detail?: string;
  at: string | null;
  internal?: boolean;
}

/** Merge the order, its gate, its stages and its issues into one dated rail. */
function buildTimeline({
  order,
  review,
  events,
  issues,
}: Pick<
  NonNullable<ReturnType<typeof useOrderDetail>["data"]>,
  "order" | "review" | "events" | "issues"
>): TimelineEntry[] {
  const entries: TimelineEntry[] = [
    { id: "created", title: "Order created", at: order.created_at },
  ];

  if (review?.started_at) {
    entries.push({ id: "gate-open", title: "Order review opened", at: review.started_at });
  }
  if (review?.decided_at) {
    entries.push({
      id: "gate-decided",
      title:
        review.outcome === "passed"
          ? "Order review approved — released to the house"
          : review.outcome === "query"
            ? "Order review sent back to the client"
            : "Order review rejected",
      detail: review.note ?? undefined,
      at: review.decided_at,
    });
  }

  for (const e of events) {
    if (!e.completed_at) continue;
    entries.push({
      id: `stage-${e.id}`,
      title: `${e.stage?.name ?? "Stage"} completed`,
      detail: e.qty_out != null ? `${formatCount(e.qty_out)} pieces out` : undefined,
      at: e.completed_at,
    });
  }

  for (const issue of issues) {
    entries.push({
      id: `issue-${issue.id}`,
      title: "Issue raised",
      detail: issue.description ?? undefined,
      at: issue.raised_at,
      internal: issue.client_visible === false,
    });
    if (issue.resolved_at) {
      entries.push({
        id: `issue-res-${issue.id}`,
        title: "Issue resolved",
        detail: issue.resolution ?? undefined,
        at: issue.resolved_at,
        internal: issue.client_visible === false,
      });
    }
  }

  return entries.sort((a, b) => {
    const ta = a.at ? new Date(a.at).getTime() : 0;
    const tb = b.at ? new Date(b.at).getTime() : 0;
    return ta - tb;
  });
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-ink-secondary">{label}</dt>
      <dd className="min-w-0 truncate text-right font-medium text-ink">{value}</dd>
    </div>
  );
}
