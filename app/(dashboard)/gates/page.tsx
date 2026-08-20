"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Inbox, MoreHorizontal, Plus } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { ScopeBar, useScope } from "@/components/shell/scope-bar";
import { MetricCard } from "@/components/ui/metric-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Dialog } from "@/components/ui/dialog";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { MetricSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  useDisplayCurrency,
  useAllReviews,
  useGateQueue,
  useIssues,
  useOrders,
  useProductionEvents,
  useProductionStages,
  qk,
  type GateRow,
} from "@/lib/queries";
import { useAutoOpenGates, useNow } from "@/lib/realtime";
import { useQueryClient } from "@tanstack/react-query";
import { GATE_TYPE_LABEL, gateStatus, openGate, waitingSince } from "@/lib/gates";
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

  const qc = useQueryClient();
  const toast = useToast();
  const [raising, setRaising] = React.useState(false);
  const [raiseOrderId, setRaiseOrderId] = React.useState("");
  const [raiseBusy, setRaiseBusy] = React.useState(false);

  const queue = useGateQueue();
  const reviews = useAllReviews();
  const orders = useOrders();
  const events = useProductionEvents();
  const stages = useProductionStages();
  const issues = useIssues();

  useAutoOpenGates(queue.data);

  const rows = React.useMemo(() => {
    const all = queue.data ?? [];
    const filtered = all.filter((r) => {
      if (scope.houseId !== "all" && r.order.house_id !== scope.houseId) return false;
      if (scope.gateType !== "all" && r.gateType !== scope.gateType) return false;
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
    const prev = previousWindow(scope.range);
    const nowMs = now || Date.now();
    const prevMs = prev.to.getTime();

    const awaiting: Kpi = {
      // The present count is the queue itself — it already includes gates that
      // are being opened this instant. The comparison is reconstructed from
      // every review's started_at / decided_at.
      value: rows.length,
      previous: pendingGatesAt(reviews.data ?? [], prevMs),
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
  }, [orders.data, events.data, issues.data, stages.data, reviews.data, rows.length, scope.range, now]);

  const currency = useDisplayCurrency();
  const loading = queue.isLoading || orders.isLoading;

  /**
   * Raise a sample gate by hand.
   *
   * The other three gate types open themselves — `deriveOpenableGates` can see
   * their triggers in the data. A sample gate's trigger is "the seller submits
   * a sample", which Sharik does not do in V1, and `approval_status` has no
   * "awaiting QC release" member to stand in for one. So until that write
   * exists, this is how a sample gate gets raised.
   */
  const raiseSampleGate = async () => {
    const order = (orders.data ?? []).find((o) => o.id === raiseOrderId);
    if (!order) return;
    setRaiseBusy(true);
    try {
      await openGate(order, "sample_release");
      qc.invalidateQueries({ queryKey: qk.gateQueue });
      qc.invalidateQueries({ queryKey: qk.reviews });
      toast({ tone: "success", title: `Sample gate raised on ${order.number}` });
      setRaising(false);
      setRaiseOrderId("");
    } catch (e) {
      toast({ tone: "error", title: "Couldn't raise the gate", description: (e as Error).message });
    } finally {
      setRaiseBusy(false);
    }
  };

  // Terminal orders cannot take a new gate.
  const raisableOrders = (orders.data ?? []).filter(
    (o) => !["declined", "cancelled", "closed", "quoting"].includes(o.status),
  );

  const columns: Column<GateRow>[] = [
    {
      id: "gateType",
      header: "Gate type",
      render: (r) => (
        <span className="inline-flex h-5 items-center rounded-sm bg-well px-1.5 text-xs font-medium text-ink-secondary">
          {GATE_TYPE_LABEL[r.gateType]}
        </span>
      ),
      sortValue: (r) => GATE_TYPE_LABEL[r.gateType],
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
            { label: "Open gate", onSelect: () => router.push(`/gates/${r.key}`) },
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
        actions={
          <Button variant="secondary" icon={<Plus />} onClick={() => setRaising(true)}>
            Raise sample gate
          </Button>
        }
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
                rowKey={(r) => r.key}
                onRowClick={(r) => router.push(`/gates/${r.key}`)}
                empty={
                  <EmptyState
                    icon={<Inbox />}
                    title="Nothing awaiting approval"
                    description="Every gate has been decided. New ones arrive the moment a client approves a proforma, a house finishes a stage, or an order is ready to ship."
                    action={{ label: "View all orders", onClick: () => router.push("/orders") }}
                  />
                }
              />
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={raising}
        onClose={() => setRaising(false)}
        title="Raise a sample gate"
        description="Order review, stage verify and dispatch gates open themselves. A sample gate waits on the house submitting a sample, which Sharik does not do yet — so raise it here."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRaising(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!raiseOrderId}
              loading={raiseBusy}
              onClick={raiseSampleGate}
            >
              Raise gate
            </Button>
          </>
        }
      >
        <Select
          label="Order"
          value={raiseOrderId}
          onChange={setRaiseOrderId}
          placeholder="Choose an order"
          options={raisableOrders.map((o) => ({ value: o.id, label: o.number }))}
        />
      </Dialog>
    </>
  );
}
