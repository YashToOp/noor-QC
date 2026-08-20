"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Inbox, MoreHorizontal } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { ScopeBar, useScope } from "@/components/shell/scope-bar";
import { MetricCard } from "@/components/ui/metric-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { MetricSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  useGateQueue,
  useIssues,
  useOrders,
  useProductionEvents,
  useProductionStages,
  type GateRow,
} from "@/lib/queries";
import { useAutoOpenGates, useNow } from "@/lib/realtime";
import { GATE_TYPE_LABEL, gateStatus, waitingSince } from "@/lib/gates";
import { gateBadge } from "@/lib/status";
import {
  delta,
  inProductionAt,
  onTimeRate,
  pendingGatesAt,
  previousWindow,
  valueAtRiskAt,
  type Kpi,
} from "@/lib/metrics";
import { formatCount, formatMoney, formatPercent, formatWaiting, UNKNOWN } from "@/lib/format";

/**
 * THE GATE QUEUE — build prompt §5.1. "What needs my decision, right now."
 *
 * Layout follows DESIGN_SYSTEM.md §7.2, with one deliberate reordering: the
 * actionable table (§7.2 item 5, normally the bottom of the page) is promoted
 * directly under the KPI row, because on this screen the queue *is* the point.
 *
 * Realtime: the queue query is invalidated by the `manufacturer_orders`
 * subscription in the dashboard layout, and `useAutoOpenGates` opens the review
 * row for any order that has just reached `approved`. A client approving a
 * proforma on a phone therefore lands a row here, and increments the sidebar
 * badge, with no refresh. See lib/realtime.ts for why the subscription is on
 * `manufacturer_orders` rather than on the review table.
 */
export default function GateQueuePage() {
  const router = useRouter();
  const now = useNow();
  const { scope, setRange, setGateType, setHouseId } = useScope("last30");

  const queue = useGateQueue();
  const orders = useOrders();
  const events = useProductionEvents();
  const stages = useProductionStages();
  const issues = useIssues();

  useAutoOpenGates(queue.data);

  const rows = React.useMemo(() => {
    const all = queue.data ?? [];
    const filtered = all.filter((r) => {
      if (scope.houseId !== "all" && r.order.house_id !== scope.houseId) return false;
      // Every gate `order_reviews` can express is an order review; the filter
      // still narrows correctly once a gate_type column exists.
      if (scope.gateType !== "all" && scope.gateType !== "order_review") return false;
      return true;
    });
    // Oldest waiting first — the whole point of a queue.
    return [...filtered].sort(
      (a, b) =>
        new Date(waitingSince(a.order, a.review)).getTime() -
        new Date(waitingSince(b.order, b.review)).getTime(),
    );
  }, [queue.data, scope.houseId, scope.gateType]);

  const kpis = React.useMemo(() => {
    const allOrders = orders.data ?? [];
    const allEvents = events.data ?? [];
    const allIssues = issues.data ?? [];
    const allStages = stages.data ?? [];
    const reviews = (queue.data ?? [])
      .map((r) => r.review)
      .filter(Boolean) as NonNullable<GateRow["review"]>[];

    const prev = previousWindow(scope.range);
    const nowMs = now || Date.now();
    const prevMs = prev.to.getTime();

    const awaiting: Kpi = {
      value: pendingGatesAt(reviews, allOrders, nowMs, true),
      previous: pendingGatesAt(reviews, allOrders, prevMs, false),
    };
    const production: Kpi = {
      value: allOrders.filter((o) => o.status === "in_production").length,
      previous: inProductionAt(allEvents, prevMs),
    };
    const atRisk: Kpi = {
      value: valueAtRiskAt(allOrders, allIssues, allEvents, nowMs),
      previous: valueAtRiskAt(allOrders, allIssues, allEvents, prevMs),
    };
    const onTime: Kpi = {
      value: onTimeRate(allOrders, allEvents, allStages, scope.range),
      previous: onTimeRate(allOrders, allEvents, allStages, prev),
    };

    return { awaiting, production, atRisk, onTime };
  }, [orders.data, events.data, issues.data, stages.data, queue.data, scope.range, now]);

  const currency = (orders.data ?? [])[0]?.currency ?? "USD";
  const loading = queue.isLoading || orders.isLoading;

  const columns: Column<GateRow>[] = [
    {
      id: "gateType",
      header: "Gate type",
      render: () => (
        <span className="inline-flex h-5 items-center rounded-sm bg-well px-1.5 text-xs font-medium text-ink-secondary">
          {GATE_TYPE_LABEL.order_review}
        </span>
      ),
      sortValue: () => GATE_TYPE_LABEL.order_review,
      width: "132px",
    },
    {
      id: "order",
      header: "Order",
      primary: true, // the primary identifier column — 14px/500 #172131
      render: (r) => r.order.number,
      sortValue: (r) => r.order.number,
      width: "128px",
    },
    {
      id: "client",
      header: "Client",
      render: (r) => r.client?.name ?? UNKNOWN,
      sortValue: (r) => r.client?.name ?? "",
    },
    {
      id: "house",
      header: "House",
      render: (r) => r.house?.name ?? UNKNOWN,
      sortValue: (r) => r.house?.name ?? "",
    },
    {
      id: "value",
      header: "Value",
      numeric: true,
      render: (r) => formatMoney(r.order.total, r.order.currency),
      sortValue: (r) => r.order.total ?? 0,
      width: "112px",
    },
    {
      id: "waiting",
      header: "Waiting",
      numeric: true,
      render: (r) => formatWaiting(waitingSince(r.order, r.review), now || Date.now()),
      sortValue: (r) => new Date(waitingSince(r.order, r.review)).getTime(),
      width: "104px",
    },
    {
      id: "status",
      header: "Status",
      render: (r) => <StatusBadge spec={gateBadge(gateStatus(r.order, r.review))} dot />,
      sortValue: (r) => gateStatus(r.order, r.review),
      width: "112px",
    },
    {
      id: "actions",
      header: "Actions",
      actions: true,
      render: (r) => (
        <DropdownMenu
          label={`Actions for ${r.order.number}`}
          trigger={
            <Button variant="ghost" className="size-8 p-0">
              <MoreHorizontal className="size-4" aria-hidden />
            </Button>
          }
          items={[
            { label: "Open gate", onSelect: () => router.push(`/gates/${r.order.id}`) },
            { label: "View order", onSelect: () => router.push(`/orders/${r.order.id}`) },
          ]}
        />
      ),
    },
  ];

  return (
    <>
      <PageHeader title="Gate queue" />

      <ScopeBar
        scope={scope}
        onRangeChange={setRange}
        onGateTypeChange={setGateType}
        onHouseChange={setHouseId}
        showGateType
      />

      {/* The panel is the only scroll container (§4.1). */}
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-12 items-stretch gap-4 pb-4">
          {loading ? (
            <>
              {[0, 1, 2, 3].map((i) => (
                <Card key={i} title=" " className="col-span-3 h-[234px]">
                  <MetricSkeleton />
                </Card>
              ))}
            </>
          ) : (
            <>
              <MetricCard
                className="col-span-3"
                title="Gates awaiting you"
                value={formatCount(kpis.awaiting.value)}
                unit="gates"
                delta={delta(kpis.awaiting)}
                invert
                comparison="vs. previous period"
              />
              <MetricCard
                className="col-span-3"
                title="Orders in production"
                value={formatCount(kpis.production.value)}
                unit="orders"
                delta={delta(kpis.production)}
                comparison="vs. previous period"
              />
              <MetricCard
                className="col-span-3"
                title="Value at risk"
                value={formatMoney(kpis.atRisk.value, currency)}
                delta={delta(kpis.atRisk)}
                invert
                comparison="open issues or a late stage"
              />
              <MetricCard
                className="col-span-3"
                title="On-time rate"
                value={kpis.onTime.value === null ? UNKNOWN : formatPercent(kpis.onTime.value)}
                unit={kpis.onTime.value === null ? undefined : "%"}
                delta={delta(kpis.onTime)}
                comparison="orders completed in range"
              />
            </>
          )}

          {/* §7.2 item 5, promoted: on this screen the queue is the point. */}
          <div className="col-span-12">
            {queue.isError ? (
              <Card title="Awaiting your decision">
                <ErrorState
                  thing="the gate queue"
                  reason={(queue.error as Error)?.message}
                  onRetry={() => queue.refetch()}
                />
              </Card>
            ) : loading ? (
              <div className="overflow-hidden rounded-xl border-hairline border-line bg-surface">
                <TableSkeleton rows={5} cols={7} />
              </div>
            ) : (
              <DataTable
                caption="Gates awaiting a decision, oldest first"
                columns={columns}
                rows={rows}
                rowKey={(r) => r.order.id}
                onRowClick={(r) => router.push(`/gates/${r.order.id}`)}
                empty={
                  <EmptyState
                    icon={<Inbox />}
                    title="Nothing awaiting approval"
                    description="Every gate has been decided. New ones arrive here the moment a client approves a proforma."
                    action={{ label: "View all orders", onClick: () => router.push("/orders") }}
                  />
                }
              />
            )}
          </div>
        </div>
      </div>
    </>
  );
}
