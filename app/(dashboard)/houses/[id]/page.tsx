"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, PackageSearch, Shirt } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { Tabs } from "@/components/ui/tabs";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { MetricSkeleton, Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { ChartCard } from "@/components/charts/chart-card";
import { RankedBarChart } from "@/components/charts/ranked-bar-chart";
import { ActivityRail } from "@/components/profile/activity-rail";
import { ContactCard, NotRecorded, Row } from "@/components/profile/profile-bits";
import { useHouseProfile } from "@/lib/queries";
import { issueBadge, orderBadge, STATUS_LABEL } from "@/lib/status";
import { ISSUE_STATUS_LABEL } from "@/lib/issues";
import { buildActivity, deliveryRecord, orderBook } from "@/lib/profile";
import type { HouseScore, ManufacturerOrder } from "@/lib/types";
import {
  formatCount,
  formatDate,
  formatDuration,
  formatMoney,
  formatPercent,
  UNKNOWN,
} from "@/lib/format";

/**
 * HOUSE 360 — everything the system holds about one manufacturing house.
 *
 * The quality tab is the point of this page: `house_scores` is the closest
 * thing Noor has to a supplier scorecard, and it is what decides who gets the
 * next order.
 */
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "orders", label: "Orders" },
  { id: "quality", label: "Quality" },
  { id: "activity", label: "Activity" },
];

export default function HouseProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const profile = useHouseProfile(params.id);
  const [tab, setTab] = React.useState("overview");

  const derived = React.useMemo(() => {
    if (!profile.data) return null;
    const d = profile.data;
    return {
      book: orderBook(d.orders),
      delivery: deliveryRecord(d.orders, d.events, d.stages),
      activity: buildActivity({
        orders: d.orders,
        events: d.events,
        stages: d.stages,
        issues: d.issues,
        auditEvents: d.auditEvents,
        orderNumberById: new Map(d.orders.map((o) => [o.id, o.number])),
      }),
    };
  }, [profile.data]);

  if (profile.isError) {
    return (
      <>
        <PageHeader title="House" breadcrumb={[{ label: "Houses", href: "/houses" }]} />
        <Card title="House">
          <ErrorState
            thing="this house"
            reason={(profile.error as Error)?.message}
            onRetry={() => profile.refetch()}
          />
        </Card>
      </>
    );
  }

  if (profile.isLoading || !profile.data || !derived) {
    return (
      <>
        <PageHeader title="House" breadcrumb={[{ label: "Houses", href: "/houses" }]} />
        <div className="grid grid-cols-12 gap-4 pt-3">
          {[0, 1, 2, 3].map((i) => (
            <Card key={i} title=" " className="col-span-3 h-[234px]">
              <MetricSkeleton />
            </Card>
          ))}
          <Card title=" " className="col-span-12 h-[280px]">
            <Skeleton className="h-full w-full" />
          </Card>
        </div>
      </>
    );
  }

  const d = profile.data;
  const { book, delivery, activity } = derived;
  const currency = d.orders[0]?.currency ?? "USD";
  const latest = d.scores[0] ?? null;
  const openIssues = d.issues.filter(
    (i) => i.status !== "resolved" && i.status !== "rejected",
  );

  /** Period label for the scorecard charts — `MMM d` of each window's end. */
  const periodLabel = (s: HouseScore) => formatDate(s.period_end);

  const onTimeByPeriod = [...d.scores]
    .reverse()
    .map((s) => ({ label: periodLabel(s), value: Number(s.on_time_pct ?? 0) }));
  const defectByPeriod = [...d.scores]
    .reverse()
    .map((s) => ({ label: periodLabel(s), value: Number(s.defect_pct ?? 0) }));

  const orderColumns: Column<ManufacturerOrder>[] = [
    {
      id: "number",
      header: "Order",
      primary: true,
      render: (o) => o.number,
      sortValue: (o) => o.number,
      width: "132px",
    },
    {
      id: "client",
      header: "Client",
      render: (o) => (o.client_id ? d.clientNames.get(o.client_id) ?? UNKNOWN : UNKNOWN),
      sortValue: (o) => (o.client_id ? d.clientNames.get(o.client_id) ?? "" : ""),
    },
    {
      id: "state",
      header: "State",
      render: (o) => STATUS_LABEL[o.status],
      sortValue: (o) => STATUS_LABEL[o.status],
    },
    {
      id: "promised",
      header: "Promised ship",
      render: (o) => (o.promised_ship_date ? formatDate(o.promised_ship_date) : UNKNOWN),
      sortValue: (o) => o.promised_ship_date ?? "",
      width: "140px",
    },
    {
      id: "value",
      header: "Value",
      numeric: true,
      render: (o) => formatMoney(o.total, o.currency),
      sortValue: (o) => o.total ?? 0,
      width: "112px",
    },
    {
      id: "status",
      header: "Status",
      render: (o) => <StatusBadge spec={orderBadge(o.status)} dot />,
      sortValue: (o) => orderBadge(o.status).label,
      width: "112px",
    },
  ];

  const scoreColumns: Column<HouseScore>[] = [
    {
      id: "period",
      header: "Period",
      primary: true,
      render: (s) => `${formatDate(s.period_start)} – ${formatDate(s.period_end)}`,
      sortValue: (s) => new Date(s.period_end).getTime(),
      width: "240px",
    },
    {
      id: "onTime",
      header: "On-time %",
      numeric: true,
      render: (s) => (s.on_time_pct == null ? UNKNOWN : `${formatPercent(Number(s.on_time_pct))}%`),
      sortValue: (s) => Number(s.on_time_pct ?? 0),
    },
    {
      id: "defect",
      header: "Defect %",
      numeric: true,
      render: (s) => (s.defect_pct == null ? UNKNOWN : `${formatPercent(Number(s.defect_pct))}%`),
      sortValue: (s) => Number(s.defect_pct ?? 0),
    },
    {
      id: "turnaround",
      header: "Approval turnaround",
      numeric: true,
      render: (s) =>
        s.avg_approval_turnaround_hours == null
          ? UNKNOWN
          : formatDuration(Number(s.avg_approval_turnaround_hours) * 3_600_000),
      sortValue: (s) => Number(s.avg_approval_turnaround_hours ?? 0),
    },
    {
      id: "claims",
      header: "Claims",
      numeric: true,
      render: (s) => formatCount(s.claims_count),
      sortValue: (s) => Number(s.claims_count ?? 0),
    },
    {
      id: "orders",
      header: "Orders",
      numeric: true,
      render: (s) => formatCount(s.orders_count),
      sortValue: (s) => Number(s.orders_count ?? 0),
    },
  ];

  return (
    <>
      <PageHeader
        title={d.house.name}
        breadcrumb={[{ label: "Houses", href: "/houses" }]}
        actions={
          <span className="text-sm text-ink-secondary">
            {[d.house.code, d.house.city, d.house.country].filter(Boolean).join(" · ")}
          </span>
        }
      />

      <Tabs tabs={TABS} active={tab} onChange={setTab} className="shrink-0" />

      <div className="min-h-0 flex-1 overflow-y-auto pt-4">
        <div className="grid grid-cols-12 items-stretch gap-4 pb-4">
          <MetricCard
            className="col-span-3"
            title="On-time rate"
            value={latest?.on_time_pct == null ? UNKNOWN : formatPercent(Number(latest.on_time_pct))}
            unit={latest?.on_time_pct == null ? undefined : "%"}
            comparison={latest ? `scorecard to ${formatDate(latest.period_end)}` : "no scorecard yet"}
          />
          <MetricCard
            className="col-span-3"
            title="Defect rate"
            value={latest?.defect_pct == null ? UNKNOWN : formatPercent(Number(latest.defect_pct))}
            unit={latest?.defect_pct == null ? undefined : "%"}
            comparison={
              latest ? `${formatCount(latest.claims_count)} claims in period` : "no scorecard yet"
            }
          />
          <MetricCard
            className="col-span-3"
            title="Approval turnaround"
            value={
              latest?.avg_approval_turnaround_hours == null
                ? UNKNOWN
                : formatDuration(Number(latest.avg_approval_turnaround_hours) * 3_600_000)
            }
            comparison="average this period"
          />
          <MetricCard
            className="col-span-3"
            title="Order value booked"
            value={formatMoney(book.lifetimeValue, currency)}
            comparison={`${formatCount(book.liveCount)} orders in flight`}
          />

          {tab === "overview" && (
            <>
              <div className="col-span-5 flex flex-col gap-4">
                <ContactCard contacts={d.contacts} />

                <Card title="The house">
                  <dl className="flex flex-col gap-3 text-sm">
                    <Row label="Code" value={d.house.code} />
                    <Row
                      label="Location"
                      value={[d.house.city, d.house.country].filter(Boolean).join(", ") || UNKNOWN}
                    />
                    <Row label="Orders all time" value={formatCount(book.total)} />
                    <Row label="Orders in flight" value={formatCount(book.liveCount)} />
                    <Row label="Orders closed" value={formatCount(book.closedCount)} />
                    <Row
                      label="Measured lateness"
                      value={
                        delivery.avgDaysLate === null
                          ? UNKNOWN
                          : `${delivery.avgDaysLate > 0 ? "+" : ""}${delivery.avgDaysLate.toFixed(1)} days`
                      }
                      hint={
                        delivery.measured === 0
                          ? "no order has finished yet"
                          : `across ${formatCount(delivery.measured)} finished orders`
                      }
                    />
                  </dl>
                  {d.house.specialities?.length ? (
                    <div className="flex flex-wrap gap-1.5 border-t border-line-divider pt-3">
                      {d.house.specialities.map((s) => (
                        <span
                          key={s}
                          className="inline-flex h-5 items-center rounded-sm bg-well px-1.5 text-xs font-medium text-ink-secondary"
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </Card>
              </div>

              <div className="col-span-7 flex flex-col gap-4">
                <Card title="Styles they make">
                  {d.styles.length === 0 ? (
                    <EmptyState
                      icon={<Shirt />}
                      title="No styles on record"
                      description="Styles are attached to a house in the catalogue."
                    />
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {d.styles.map((s) => (
                        <li key={s.id} className="flex items-center justify-between gap-3">
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-medium text-ink">{s.name}</span>
                            <span className="truncate text-xs text-ink-secondary">
                              {[s.code, s.fabric].filter(Boolean).join(" · ")}
                            </span>
                          </span>
                          <span className="flex shrink-0 flex-col items-end">
                            <span className="text-sm tabular-nums text-ink">
                              {formatMoney(s.base_price, currency)}
                            </span>
                            <span className="text-xs tabular-nums text-ink-secondary">
                              {s.lead_time_days == null
                                ? UNKNOWN
                                : `${formatCount(s.lead_time_days)} day lead`}
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>

                {/*
                  There is no house-side finance in this schema: invoices,
                  payments, credit_notes and ledger_entries are all keyed by
                  client_id. Saying so beats an empty "Payables" card that
                  reads like a bug.
                */}
                <NotRecorded
                  title="Payables"
                  what="What Noor owes this house is not recorded"
                  why="invoices, payments, credit_notes and ledger_entries are all keyed by client_id — the schema has no house-side money. Order value booked, on the scorecard above, is the closest real figure."
                />
              </div>
            </>
          )}

          {tab === "orders" && (
            <div className="col-span-12">
              <DataTable
                caption={`Orders placed with ${d.house.name}`}
                columns={orderColumns}
                rows={d.orders}
                rowKey={(o) => o.id}
                onRowClick={(o) => router.push(`/orders/${o.id}`)}
                defaultSort={{ columnId: "promised", direction: "desc" }}
                empty={
                  <EmptyState
                    icon={<PackageSearch />}
                    title="No orders yet"
                    description="Orders appear here once one is released to this house."
                  />
                }
              />
            </div>
          )}

          {tab === "quality" && (
            <>
              {/*
                Two separate single-measure charts rather than one with both
                series: on-time sits near 95% and defects near 2%, and putting
                them on one axis would need a second scale — which §6.3 rules
                out absolutely. Ranked bars because the scorecard has a handful
                of periods, not a time series.
              */}
              <ChartCard
                className="col-span-6"
                title="On-time % by period"
                height={290}
                rowHeaders={["On-time %"]}
                rows={onTimeByPeriod.map((p) => ({ label: p.label, values: [p.value.toFixed(1)] }))}
                filename={`${d.house.code}-on-time`}
              >
                <RankedBarChart
                  data={onTimeByPeriod}
                  name="On-time %"
                  ariaLabel={`On-time percentage by scorecard period for ${d.house.name}`}
                  valueFormatter={(v) => `${formatPercent(Number(v))}%`}
                  maxLabelWidth={104}
                />
              </ChartCard>

              <ChartCard
                className="col-span-6"
                title="Defect % by period"
                height={290}
                rowHeaders={["Defect %"]}
                rows={defectByPeriod.map((p) => ({ label: p.label, values: [p.value.toFixed(1)] }))}
                filename={`${d.house.code}-defects`}
              >
                <RankedBarChart
                  data={defectByPeriod}
                  name="Defect %"
                  ariaLabel={`Defect percentage by scorecard period for ${d.house.name}`}
                  valueFormatter={(v) => `${formatPercent(Number(v))}%`}
                  maxLabelWidth={104}
                />
              </ChartCard>

              <div className="col-span-12">
                <DataTable
                  caption={`Scorecard periods for ${d.house.name}`}
                  columns={scoreColumns}
                  rows={d.scores}
                  rowKey={(s) => `${s.house_id}-${s.period_end}`}
                  defaultSort={{ columnId: "period", direction: "desc" }}
                  empty={
                    <EmptyState
                      icon={<AlertTriangle />}
                      title="No scorecard yet"
                      description="house_scores is computed per period. Nothing has been published for this house."
                    />
                  }
                />
              </div>

              <div className="col-span-12">
                <Card title="Issues raised against this house">
                  {d.issues.length === 0 ? (
                    <p className="text-sm text-ink-secondary">Nothing has been raised.</p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {d.issues.map((issue) => (
                        <li key={issue.id} className="flex items-start gap-2">
                          <AlertTriangle
                            className="mt-0.5 size-4 shrink-0 text-state-warning"
                            aria-hidden
                          />
                          <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="text-sm text-ink">
                              {issue.description ?? UNKNOWN}
                            </span>
                            <span className="flex flex-wrap items-center gap-2">
                              <StatusBadge
                                spec={{
                                  ...issueBadge(issue.status),
                                  label: ISSUE_STATUS_LABEL[issue.status],
                                }}
                              />
                              <span className="text-xs text-ink-secondary">
                                raised {formatDate(issue.raised_at)}
                                {issue.cost_impact != null &&
                                  ` · ${formatMoney(Number(issue.cost_impact), currency)} impact`}
                              </span>
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {openIssues.length > 0 && (
                    <p className="border-t border-line-divider pt-3 text-xs text-ink-secondary">
                      {formatCount(openIssues.length)} still open.
                    </p>
                  )}
                </Card>
              </div>
            </>
          )}

          {tab === "activity" && (
            <div className="col-span-12">
              <Card title="Everything that has happened">
                <ActivityRail entries={activity} />
              </Card>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
