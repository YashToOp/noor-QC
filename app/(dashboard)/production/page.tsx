"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Factory } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { Select } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { MetricSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Tooltip } from "@/components/ui/tooltip";
import {
  useClients,
  useHouses,
  useOrders,
  useProductionEvents,
  useProductionStages,
} from "@/lib/queries";
import { useNow } from "@/lib/realtime";
import { orderBadge } from "@/lib/status";
import type { ManufacturerOrder, ProductionEvent, ProductionStage } from "@/lib/types";
import { formatCount, formatDate, UNKNOWN } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * PRODUCTION — the floor, one row per order with a live stage ladder.
 *
 * Sharik owns the progress writes; this board reads them. The ladder is drawn
 * as a strip of stage pips rather than a progress bar because the operator's
 * question is "which stage is it stuck on", not "what percentage is done" —
 * and a pip carries its stage name and state in a tooltip, so the strip is not
 * colour-only (§8).
 */
interface Row {
  order: ManufacturerOrder;
  ladder: (ProductionEvent & { stage: ProductionStage | null })[];
  done: number;
  total: number;
  current: (ProductionEvent & { stage: ProductionStage | null }) | null;
  nextDue: string | null;
  daysLate: number;
  qtyOut: number | null;
}

export default function ProductionPage() {
  const router = useRouter();
  const now = useNow();
  const nowMs = now || Date.now();

  const orders = useOrders();
  const events = useProductionEvents();
  const stages = useProductionStages();
  const houses = useHouses();
  const clients = useClients();

  const [houseId, setHouseId] = React.useState("all");
  const [only, setOnly] = React.useState("live");

  const houseById = React.useMemo(
    () => new Map((houses.data ?? []).map((h) => [h.id, h])),
    [houses.data],
  );
  const clientById = React.useMemo(
    () => new Map((clients.data ?? []).map((c) => [c.id, c])),
    [clients.data],
  );

  const rows = React.useMemo<Row[]>(() => {
    const stageById = new Map((stages.data ?? []).map((s) => [s.id, s]));
    const byOrder = new Map<string, (ProductionEvent & { stage: ProductionStage | null })[]>();

    for (const e of events.data ?? []) {
      const decorated = { ...e, stage: stageById.get(e.stage_id) ?? null };
      const bucket = byOrder.get(e.manufacturer_order_id);
      if (bucket) bucket.push(decorated);
      else byOrder.set(e.manufacturer_order_id, [decorated]);
    }

    const out: Row[] = [];
    for (const order of orders.data ?? []) {
      const ladder = (byOrder.get(order.id) ?? []).sort(
        (a, b) => (a.stage?.sort ?? 0) - (b.stage?.sort ?? 0),
      );
      if (!ladder.length) continue;

      const done = ladder.filter((e) => e.status === "completed" || e.status === "skipped").length;
      // The stage in flight is the lowest one not yet finished — Sharik works
      // strictly in order, so there is never more than one.
      const current = ladder.find((e) => e.status !== "completed" && e.status !== "skipped") ?? null;

      let daysLate = 0;
      let nextDue: string | null = null;
      if (current?.expected_at) {
        nextDue = current.expected_at;
        const expected = new Date(`${current.expected_at}T23:59:59`).getTime();
        if (expected < nowMs) daysLate = Math.floor((nowMs - expected) / 86_400_000);
      }

      const lastOut = [...ladder].reverse().find((e) => e.qty_out != null);

      out.push({
        order,
        ladder,
        done,
        total: ladder.length,
        current,
        nextDue,
        daysLate,
        qtyOut: lastOut?.qty_out ?? null,
      });
    }

    return out.filter((r) => {
      if (houseId !== "all" && r.order.house_id !== houseId) return false;
      if (only === "live") return r.done < r.total;
      if (only === "late") return r.daysLate > 0;
      return true;
    });
  }, [orders.data, events.data, stages.data, houseId, only, nowMs]);

  const loading = orders.isLoading || events.isLoading || stages.isLoading;

  const liveCount = rows.filter((r) => r.done < r.total).length;
  const lateCount = rows.filter((r) => r.daysLate > 0).length;
  const piecesInFlight = rows
    .filter((r) => r.done < r.total)
    .reduce((sum, r) => sum + Number(r.qtyOut ?? r.ladder[0]?.qty_in ?? 0), 0);
  const worstLate = rows.reduce((m, r) => Math.max(m, r.daysLate), 0);

  const columns: Column<Row>[] = [
    {
      id: "order",
      header: "Order",
      primary: true,
      render: (r) => r.order.number,
      sortValue: (r) => r.order.number,
      width: "140px",
    },
    {
      id: "client",
      header: "Client",
      render: (r) =>
        r.order.client_id ? clientById.get(r.order.client_id)?.name ?? UNKNOWN : UNKNOWN,
      sortValue: (r) => (r.order.client_id ? clientById.get(r.order.client_id)?.name ?? "" : ""),
    },
    {
      id: "house",
      header: "House",
      render: (r) => (r.order.house_id ? houseById.get(r.order.house_id)?.name ?? UNKNOWN : UNKNOWN),
      sortValue: (r) => (r.order.house_id ? houseById.get(r.order.house_id)?.name ?? "" : ""),
    },
    {
      id: "ladder",
      header: "Ladder",
      render: (r) => (
        <span className="flex items-center gap-1" role="img" aria-label={ladderLabel(r)}>
          {r.ladder.map((e) => (
            <Tooltip key={e.id} label={`${e.stage?.name ?? "Stage"} — ${stageWord(e.status)}`}>
              <span
                className={cn(
                  "h-1.5 w-4 shrink-0 rounded-full",
                  e.status === "completed" && "bg-state-success",
                  e.status === "in_progress" && "bg-[#6895ff]",
                  e.status === "blocked" && "bg-state-error",
                  e.status === "skipped" && "bg-line-hover",
                  e.status === "pending" && "bg-line",
                )}
              />
            </Tooltip>
          ))}
        </span>
      ),
      sortValue: (r) => r.done / r.total,
      width: "180px",
    },
    {
      id: "current",
      header: "Current stage",
      render: (r) =>
        r.current ? (
          <span className="flex flex-col">
            <span className="text-ink">{r.current.stage?.name ?? UNKNOWN}</span>
            <span className="text-xs text-ink-secondary">
              {formatCount(r.done)} of {formatCount(r.total)} done
            </span>
          </span>
        ) : (
          <span className="text-ink-secondary">Ladder complete</span>
        ),
      sortValue: (r) => r.current?.stage?.sort ?? 99,
      width: "180px",
    },
    {
      id: "pieces",
      header: "Pieces",
      numeric: true,
      render: (r) =>
        r.qtyOut == null ? <span className="text-ink-disabled">—</span> : formatCount(r.qtyOut),
      sortValue: (r) => r.qtyOut ?? 0,
      width: "96px",
    },
    {
      id: "due",
      header: "Stage due",
      render: (r) =>
        r.nextDue ? (
          <span className={cn(r.daysLate > 0 && "font-medium text-[#8c1a20]")}>
            {formatDate(r.nextDue)}
            {r.daysLate > 0 && ` · ${formatCount(r.daysLate)}d late`}
          </span>
        ) : (
          <span className="text-ink-disabled">—</span>
        ),
      sortValue: (r) => (r.nextDue ? new Date(r.nextDue).getTime() : Number.MAX_SAFE_INTEGER),
      width: "180px",
    },
    {
      id: "status",
      header: "Status",
      render: (r) => <StatusBadge spec={orderBadge(r.order.status)} dot />,
      sortValue: (r) => orderBadge(r.order.status).label,
      width: "112px",
    },
  ];

  return (
    <>
      <PageHeader title="Production" />

      <div className="my-3 flex shrink-0 items-center gap-2">
        <Select
          className="w-[180px]"
          value={only}
          onChange={setOnly}
          options={[
            { value: "live", label: "In production" },
            { value: "late", label: "Behind schedule" },
            { value: "all", label: "Every ladder" },
          ]}
        />
        <Select
          className="w-[180px]"
          value={houseId}
          onChange={setHouseId}
          options={[
            { value: "all", label: "All houses" },
            ...(houses.data ?? []).map((h) => ({ value: h.id, label: h.name })),
          ]}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-12 items-stretch gap-4 pb-4">
          {loading ? (
            [0, 1, 2, 3].map((i) => (
              <Card key={i} title=" " className="col-span-3 h-[234px]">
                <MetricSkeleton />
              </Card>
            ))
          ) : (
            <>
              <MetricCard
                className="col-span-3"
                title="Ladders running"
                value={formatCount(liveCount)}
                unit="orders"
                comparison="stages still to finish"
              />
              <MetricCard
                className="col-span-3"
                title="Behind schedule"
                value={formatCount(lateCount)}
                unit="orders"
                comparison="current stage past its date"
              />
              <MetricCard
                className="col-span-3"
                title="Pieces in flight"
                value={formatCount(piecesInFlight)}
                comparison="latest count on each live ladder"
              />
              <MetricCard
                className="col-span-3"
                title="Worst delay"
                value={worstLate === 0 ? "0" : formatCount(worstLate)}
                unit="days"
                comparison="on any current stage"
              />
            </>
          )}

          <div className="col-span-12">
            {events.isError ? (
              <Card title="Production">
                <ErrorState
                  thing="the production board"
                  reason={(events.error as Error)?.message}
                  onRetry={() => events.refetch()}
                />
              </Card>
            ) : loading ? (
              <div className="overflow-hidden rounded-xl border-hairline border-line bg-surface">
                <TableSkeleton rows={5} cols={7} />
              </div>
            ) : (
              <DataTable
                caption="Orders on the production floor"
                columns={columns}
                rows={rows}
                rowKey={(r) => r.order.id}
                onRowClick={(r) => router.push(`/orders/${r.order.id}`)}
                defaultSort={{ columnId: "due", direction: "asc" }}
                empty={
                  <EmptyState
                    icon={<Factory />}
                    title={
                      only === "late" ? "Nothing is behind schedule" : "Nothing in production"
                    }
                    description={
                      only === "late"
                        ? "Every current stage is inside its expected date."
                        : "A ladder is created when an order review is approved and the order is released."
                    }
                    action={{ label: "Go to the gate queue", onClick: () => router.push("/gates") }}
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

function stageWord(status: string): string {
  switch (status) {
    case "completed":
      return "done";
    case "in_progress":
      return "in progress";
    case "blocked":
      return "blocked";
    case "skipped":
      return "skipped";
    default:
      return "not started";
  }
}

/** The whole ladder in words, for anyone not reading the pips. */
function ladderLabel(r: Row): string {
  return r.ladder.map((e) => `${e.stage?.name ?? "Stage"} ${stageWord(e.status)}`).join(", ");
}
