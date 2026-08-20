"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { ScopeBar, useScope } from "@/components/shell/scope-bar";
import { MetricCard } from "@/components/ui/metric-card";
import { Card } from "@/components/ui/card";
import { MetricSkeleton } from "@/components/ui/skeleton";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusBadge } from "@/components/ui/status-badge";
import { ChartCard } from "@/components/charts/chart-card";
import { TrendChart } from "@/components/charts/trend-chart";
import { DonutChart } from "@/components/charts/donut-chart";
import { RankedBarChart } from "@/components/charts/ranked-bar-chart";
import {
  useDisplayCurrency,
  useClients,
  useGateQueue,
  useHouseScores,
  useHouses,
  useIssueTypes,
  useIssues,
  useOrders,
  useProductionEvents,
  useProductionStages,
  useAllReviews,
} from "@/lib/queries";
import { useNow } from "@/lib/realtime";
import { orderBadge } from "@/lib/status";
import { SELLER_VISIBLE } from "@/lib/types";
import {
  delta,
  inProductionAt,
  onTimeRate,
  ordersBehindSchedule,
  pendingGatesAt,
  previousWindow,
  valueAtRiskAt,
  weeklyBuckets,
  type Kpi,
} from "@/lib/metrics";
import { formatCount, formatMoney, formatPercent, UNKNOWN } from "@/lib/format";

/**
 * HOME — the command dashboard. DESIGN_SYSTEM.md §7.2, in order:
 * scope bar → KPI row → col-span-8 trend + col-span-4 donut → four small
 * charts → col-span-12 actionable table.
 *
 * CHART HONESTY (build prompt §5.3): the seed dataset is small. Any chart that
 * would draw fewer than five points ships as a table instead — a sparse line
 * looks broken and costs more than the chart gains.
 *
 * What counts as a "point" is the part worth getting right. `weeklyBuckets`
 * emits one bucket per week in the range whether or not anything happened, so
 * counting buckets would say "five points" for a flat line of five zeros —
 * exactly the chart the rule exists to prevent. So the test counts buckets
 * that actually carry data.
 */
const MIN_POINTS = 5;

function carriesEnoughData(points: { value: number }[]): boolean {
  return points.filter((p) => p.value > 0).length >= MIN_POINTS;
}

export default function HomePage() {
  const router = useRouter();
  const now = useNow();
  const { scope, setRange, setHouseId } = useScope("last30");

  const orders = useOrders();
  const events = useProductionEvents();
  const stages = useProductionStages();
  const issues = useIssues();
  const issueTypes = useIssueTypes();
  const houses = useHouses();
  const scores = useHouseScores();
  const clients = useClients();
  const queue = useGateQueue();
  const reviews = useAllReviews();

  const scoped = React.useMemo(
    () =>
      (orders.data ?? []).filter(
        (o) => scope.houseId === "all" || o.house_id === scope.houseId,
      ),
    [orders.data, scope.houseId],
  );

  const currency = useDisplayCurrency();
  const nowMs = now || Date.now();

  const kpis = React.useMemo(() => {
    const allEvents = events.data ?? [];
    const allIssues = issues.data ?? [];
    const allStages = stages.data ?? [];
    const prev = previousWindow(scope.range);
    const prevMs = prev.to.getTime();

    const awaiting: Kpi = {
      // The present count is the queue itself — it already includes gates that
      // are being opened this instant. The comparison is reconstructed from
      // every review's started_at / decided_at.
      value: queue.data?.length ?? 0,
      previous: pendingGatesAt(reviews.data ?? [], prevMs),
    };
    const production: Kpi = {
      value: scoped.filter((o) => o.status === "in_production").length,
      previous: inProductionAt(allEvents, prevMs),
    };
    const atRisk: Kpi = {
      value: valueAtRiskAt(scoped, allIssues, allEvents, nowMs),
      previous: valueAtRiskAt(scoped, allIssues, allEvents, prevMs),
    };
    const onTime: Kpi = {
      value: onTimeRate(scoped, allEvents, allStages, scope.range),
      previous: onTimeRate(scoped, allEvents, allStages, prev),
    };
    return { awaiting, production, atRisk, onTime };
  }, [scoped, events.data, issues.data, stages.data, queue.data, reviews.data, scope.range, nowMs]);

  /**
   * Orders released per week.
   *
   * There is no status-history table, so the moment an order was released is
   * not directly recorded. `updated_at` on an order that has reached the
   * seller-visible set is the closest timestamp the schema carries, and it is
   * exact for orders still sitting at `released`.
   */
  const releasedTrend = React.useMemo(
    () =>
      weeklyBuckets(
        scoped
          .filter((o) => SELLER_VISIBLE.includes(o.status))
          .map((o) => o.updated_at ?? o.created_at),
        scope.range,
      ),
    [scoped, scope.range],
  );

  const statusDonut = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const o of scoped) {
      const label = orderBadge(o.status).label;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()].map(([name, value]) => ({ name, value }));
  }, [scoped]);

  const houseOnTime = React.useMemo(() => {
    const byHouse = new Map((houses.data ?? []).map((h) => [h.id, h.name]));
    const latest = new Map<string, number>();
    for (const s of scores.data ?? []) {
      if (s.on_time_pct == null || latest.has(s.house_id)) continue;
      latest.set(s.house_id, Number(s.on_time_pct));
    }
    return [...latest.entries()].map(([id, value]) => ({
      label: byHouse.get(id) ?? UNKNOWN,
      value,
    }));
  }, [houses.data, scores.data]);

  const issuesByType = React.useMemo(() => {
    const nameById = new Map((issueTypes.data ?? []).map((t) => [t.id, t.name]));
    const counts = new Map<string, number>();
    for (const i of issues.data ?? []) {
      const label = i.issue_type_id ? nameById.get(i.issue_type_id) ?? "Other" : "Other";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()].map(([label, value]) => ({ label, value }));
  }, [issues.data, issueTypes.data]);

  /** Gate throughput — gates decided per week, from `order_reviews.decided_at`. */
  const gateThroughput = React.useMemo(() => {
    const decided = (queue.data ?? [])
      .map((r) => r.review?.decided_at)
      .filter(Boolean) as string[];
    return weeklyBuckets(decided, scope.range);
  }, [queue.data, scope.range]);

  const valueByClient = React.useMemo(() => {
    const nameById = new Map((clients.data ?? []).map((c) => [c.id, c.name]));
    const totals = new Map<string, number>();
    for (const o of scoped) {
      if (!o.client_id) continue;
      const label = nameById.get(o.client_id) ?? UNKNOWN;
      totals.set(label, (totals.get(label) ?? 0) + (o.total ?? 0));
    }
    return [...totals.entries()].map(([label, value]) => ({ label, value }));
  }, [scoped, clients.data]);

  const behind = React.useMemo(
    () => ordersBehindSchedule(scoped, events.data ?? [], stages.data ?? [], nowMs),
    [scoped, events.data, stages.data, nowMs],
  );

  const loading = orders.isLoading || events.isLoading;

  type BehindRow = (typeof behind)[number];
  const clientName = new Map((clients.data ?? []).map((c) => [c.id, c.name]));
  const houseName = new Map((houses.data ?? []).map((h) => [h.id, h.name]));

  const behindColumns: Column<BehindRow>[] = [
    {
      id: "order",
      header: "Order",
      primary: true,
      render: (r) => r.order.number,
      sortValue: (r) => r.order.number,
      width: "128px",
    },
    {
      id: "client",
      header: "Client",
      render: (r) => (r.order.client_id ? clientName.get(r.order.client_id) ?? UNKNOWN : UNKNOWN),
      sortValue: (r) => (r.order.client_id ? clientName.get(r.order.client_id) ?? "" : ""),
    },
    {
      id: "house",
      header: "House",
      render: (r) => (r.order.house_id ? houseName.get(r.order.house_id) ?? UNKNOWN : UNKNOWN),
      sortValue: (r) => (r.order.house_id ? houseName.get(r.order.house_id) ?? "" : ""),
    },
    {
      id: "stage",
      header: "Stage",
      render: (r) => r.stage?.name ?? UNKNOWN,
      sortValue: (r) => r.stage?.sort ?? 0,
    },
    {
      id: "late",
      header: "Days late",
      numeric: true,
      render: (r) => formatCount(r.daysLate),
      sortValue: (r) => r.daysLate,
      width: "104px",
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
      id: "status",
      header: "Status",
      render: (r) => <StatusBadge spec={orderBadge(r.order.status)} dot />,
      sortValue: (r) => r.order.status,
      width: "112px",
    },
  ];

  return (
    <>
      <PageHeader title="Home" />

      <ScopeBar scope={scope} onRangeChange={setRange} onHouseChange={setHouseId} />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-12 items-stretch gap-4 pb-4">
          {/* KPI row — §7.2 item 2. */}
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

          {/* Primary trend + breakdown — §7.2 item 3. */}
          <ChartCard
            className="col-span-8"
            title="Orders released per week"
            height={398}
            rowHeaders={["Orders"]}
            rows={releasedTrend.map((p) => ({ label: p.label, values: [p.value] }))}
            filename="orders-released-per-week"
            defaultView={carriesEnoughData(releasedTrend) ? "chart" : "table"}
          >
            <TrendChart
              data={releasedTrend}
              name="Orders released"
              ariaLabel="Orders released per week over the selected range"
              valueFormatter={(v) => formatCount(Number(v))}
            />
          </ChartCard>

          <ChartCard
            className="col-span-4"
            title="Orders by status"
            height={398}
            rowHeaders={["Orders"]}
            rows={statusDonut.map((s) => ({ label: s.name, values: [s.value] }))}
            filename="orders-by-status"
          >
            <DonutChart
              data={statusDonut}
              totalLabel="orders"
              ariaLabel="Orders broken down by status"
            />
          </ChartCard>

          {/* Four small charts — §7.2 item 4, all 290px so the row is level. */}
          <ChartCard
            className="col-span-3"
            title="House on-time %"
            height={290}
            rowHeaders={["On-time %"]}
            rows={houseOnTime.map((h) => ({ label: h.label, values: [h.value.toFixed(1)] }))}
            filename="house-on-time"
          >
            <RankedBarChart
              data={houseOnTime}
              name="On-time %"
              ariaLabel="On-time percentage by house"
              valueFormatter={(v) => `${formatPercent(Number(v))}%`}
            />
          </ChartCard>

          <ChartCard
            className="col-span-3"
            title="Issues by type"
            height={290}
            rowHeaders={["Issues"]}
            rows={issuesByType.map((i) => ({ label: i.label, values: [i.value] }))}
            filename="issues-by-type"
          >
            <RankedBarChart
              data={issuesByType}
              name="Issues"
              ariaLabel="Issue count by type"
              valueFormatter={(v) => formatCount(Number(v))}
            />
          </ChartCard>

          <ChartCard
            className="col-span-3"
            title="Gate throughput"
            height={290}
            rowHeaders={["Gates decided"]}
            rows={gateThroughput.map((p) => ({ label: p.label, values: [p.value] }))}
            filename="gate-throughput"
            defaultView={carriesEnoughData(gateThroughput) ? "chart" : "table"}
          >
            <TrendChart
              data={gateThroughput}
              name="Gates decided"
              ariaLabel="Gates decided per week"
              valueFormatter={(v) => formatCount(Number(v))}
            />
          </ChartCard>

          <ChartCard
            className="col-span-3"
            title="Value by client"
            height={290}
            rowHeaders={["Value"]}
            rows={valueByClient.map((c) => ({
              label: c.label,
              values: [formatMoney(c.value, currency)],
            }))}
            filename="value-by-client"
          >
            <RankedBarChart
              data={valueByClient}
              name="Value"
              ariaLabel="Order value by client"
              valueFormatter={(v) => formatMoney(Number(v), currency)}
            />
          </ChartCard>

          {/* Actionable table — §7.2 item 5. */}
          <div className="col-span-12">
            <DataTable
              caption="Orders behind schedule, latest first"
              columns={behindColumns}
              rows={behind}
              rowKey={(r) => r.order.id}
              onRowClick={(r) => router.push(`/orders/${r.order.id}`)}
              defaultSort={{ columnId: "late", direction: "desc" }}
              empty={
                <EmptyState
                  icon={<CalendarCheck />}
                  title="Nothing is behind schedule"
                  description="Every stage on every live order is inside its expected date."
                  action={{ label: "View all orders", onClick: () => router.push("/orders") }}
                />
              }
            />
          </div>
        </div>
      </div>
    </>
  );
}
