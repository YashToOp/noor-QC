"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { AlertTriangle, EyeOff, PackageSearch } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { Tabs } from "@/components/ui/tabs";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { MetricSkeleton, Skeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { ActivityRail } from "@/components/profile/activity-rail";
import { ContactCard, Row } from "@/components/profile/profile-bits";
import { useClientProfile } from "@/lib/queries";
import { useNow } from "@/lib/realtime";
import { issueBadge, orderBadge, STATUS_LABEL } from "@/lib/status";
import { ISSUE_STATUS_LABEL } from "@/lib/issues";
import {
  buildActivity,
  clientBalance,
  deliveryRecord,
  orderBook,
} from "@/lib/profile";
import type { LedgerEntry, ManufacturerOrder } from "@/lib/types";
import {
  formatCount,
  formatDate,
  formatMoney,
  formatMoneyFull,
  formatPercent,
  UNKNOWN,
} from "@/lib/format";

/**
 * CLIENT 360 — everything the system holds about one client.
 *
 * Four tabs (§4.4) rather than one long page: the questions asked of a client
 * fall into distinct sessions — who are they, what have they ordered, what do
 * they owe, what has been happening — and stacking all of it vertically would
 * bury the money under the order table.
 */
const TABS = [
  { id: "overview", label: "Overview" },
  { id: "orders", label: "Orders" },
  { id: "finance", label: "Finance" },
  { id: "activity", label: "Activity" },
];

export default function ClientProfilePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const now = useNow();
  const profile = useClientProfile(params.id);
  const [tab, setTab] = React.useState("overview");

  const nowMs = now || Date.now();

  const derived = React.useMemo(() => {
    if (!profile.data) return null;
    const d = profile.data;
    const book = orderBook(d.orders);
    const balance = clientBalance(
      d.invoices,
      d.payments,
      d.creditNotes,
      nowMs,
      d.client.currency ?? "USD",
    );
    const delivery = deliveryRecord(d.orders, d.events, d.stages);
    const activity = buildActivity({
      orders: d.orders,
      events: d.events,
      stages: d.stages,
      issues: d.issues,
      enquiries: d.enquiries,
      invoices: d.invoices,
      payments: d.payments,
      creditNotes: d.creditNotes,
      auditEvents: d.auditEvents,
      orderNumberById: new Map(d.orders.map((o) => [o.id, o.number])),
    });
    return { book, balance, delivery, activity };
  }, [profile.data, nowMs]);

  if (profile.isError) {
    return (
      <>
        <PageHeader title="Client" breadcrumb={[{ label: "Clients", href: "/clients" }]} />
        <Card title="Client">
          <ErrorState
            thing="this client"
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
        <PageHeader title="Client" breadcrumb={[{ label: "Clients", href: "/clients" }]} />
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
  const { book, balance, delivery, activity } = derived;
  const currency = d.client.currency ?? "USD";
  const openIssues = d.issues.filter(
    (i) => i.status !== "resolved" && i.status !== "rejected",
  );

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
      id: "house",
      header: "House",
      render: (o) => (o.house_id ? d.houseNames.get(o.house_id) ?? UNKNOWN : UNKNOWN),
      sortValue: (o) => (o.house_id ? d.houseNames.get(o.house_id) ?? "" : ""),
    },
    {
      id: "state",
      header: "State",
      render: (o) => STATUS_LABEL[o.status],
      sortValue: (o) => STATUS_LABEL[o.status],
    },
    {
      id: "raised",
      header: "Raised",
      render: (o) => formatDate(o.created_at),
      sortValue: (o) => new Date(o.created_at).getTime(),
      width: "132px",
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

  const ledgerColumns: Column<LedgerEntry>[] = [
    {
      id: "date",
      header: "Date",
      primary: true,
      render: (l) => formatDate(l.occurred_at),
      sortValue: (l) => new Date(l.occurred_at ?? 0).getTime(),
      width: "132px",
    },
    {
      id: "kind",
      header: "Kind",
      render: (l) => (
        <span className="inline-flex h-5 items-center rounded-sm bg-well px-1.5 text-xs font-medium text-ink-secondary">
          {l.kind.replace(/_/g, " ")}
        </span>
      ),
      sortValue: (l) => l.kind,
      width: "128px",
    },
    {
      id: "description",
      header: "Description",
      render: (l) => l.description ?? UNKNOWN,
      sortValue: (l) => l.description ?? "",
    },
    {
      id: "amount",
      header: "Amount",
      numeric: true,
      render: (l) => formatMoneyFull(Number(l.amount ?? 0), l.currency ?? currency),
      sortValue: (l) => Number(l.amount ?? 0),
      width: "132px",
    },
  ];

  return (
    <>
      <PageHeader
        title={d.client.name}
        breadcrumb={[{ label: "Clients", href: "/clients" }]}
        actions={
          <span className="text-sm text-ink-secondary">
            {[d.client.code, d.client.city, d.client.country].filter(Boolean).join(" · ")}
          </span>
        }
      />

      <Tabs tabs={TABS} active={tab} onChange={setTab} className="shrink-0" />

      <div className="min-h-0 flex-1 overflow-y-auto pt-4">
        <div className="grid grid-cols-12 items-stretch gap-4 pb-4">
          {/* KPI row is shared across tabs — it is the answer to "how is this
              relationship doing", which every tab is a detail of. */}
          <MetricCard
            className="col-span-3"
            title="Lifetime order value"
            value={formatMoney(book.lifetimeValue, currency)}
            comparison={`${formatCount(book.total)} orders all time`}
          />
          <MetricCard
            className="col-span-3"
            title="Live order value"
            value={formatMoney(book.liveValue, currency)}
            comparison={`${formatCount(book.liveCount)} orders in flight`}
          />
          <MetricCard
            className="col-span-3"
            title="Outstanding"
            value={formatMoney(balance.outstanding, balance.currency)}
            comparison={
              balance.overdue > 0
                ? `${formatMoney(balance.overdue, balance.currency)} of it overdue`
                : "nothing overdue"
            }
          />
          <MetricCard
            className="col-span-3"
            title="On-time delivery"
            value={
              delivery.onTimePct === null ? UNKNOWN : formatPercent(delivery.onTimePct)
            }
            unit={delivery.onTimePct === null ? undefined : "%"}
            comparison={
              delivery.measured === 0
                ? "no order has finished yet"
                : `${formatCount(delivery.onTime)} of ${formatCount(delivery.measured)} on their date`
            }
          />

          {tab === "overview" && (
            <>
              <div className="col-span-5 flex flex-col gap-4">
                <ContactCard contacts={d.contacts} />

                <Card title="Working limit">
                  {d.limit ? (
                    <dl className="flex flex-col gap-3 text-sm">
                      <Row label="Season" value={d.limit.season ?? UNKNOWN} />
                      <Row
                        label="Declared"
                        value={formatMoneyFull(d.limit.amount ?? 0, d.limit.currency ?? currency)}
                      />
                      <Row
                        label="Committed"
                        value={formatMoneyFull(
                          d.limit.committed ?? 0,
                          d.limit.currency ?? currency,
                        )}
                      />
                      <Row
                        label="Headroom"
                        value={formatMoneyFull(
                          (d.limit.amount ?? 0) - (d.limit.committed ?? 0),
                          d.limit.currency ?? currency,
                        )}
                      />
                      <Row label="State" value={d.limit.status} />
                    </dl>
                  ) : (
                    <p className="text-sm text-ink-secondary">
                      No working limit is on record for this client.
                    </p>
                  )}
                </Card>
              </div>

              <div className="col-span-7 flex flex-col gap-4">
                <Card title="Account">
                  <dl className="flex flex-col gap-3 text-sm">
                    <Row label="Code" value={d.client.code} />
                    <Row
                      label="Location"
                      value={[d.client.city, d.client.country].filter(Boolean).join(", ") || UNKNOWN}
                    />
                    <Row label="Currency" value={currency} />
                    <Row label="Orders won" value={formatCount(book.total - book.lostCount)} />
                    <Row label="Orders lost" value={formatCount(book.lostCount)} />
                    <Row label="Enquiries" value={formatCount(d.enquiries.length)} />
                    <Row
                      label="Average lateness"
                      value={
                        delivery.avgDaysLate === null
                          ? UNKNOWN
                          : `${delivery.avgDaysLate > 0 ? "+" : ""}${delivery.avgDaysLate.toFixed(1)} days`
                      }
                      hint={delivery.avgDaysLate === null ? undefined : "against the promised date"}
                    />
                  </dl>
                </Card>

                <Card title="Open issues">
                  {openIssues.length === 0 ? (
                    <p className="text-sm text-ink-secondary">
                      Nothing open against this client&rsquo;s orders.
                    </p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {openIssues.map((issue) => (
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
                            <span className="text-sm text-ink">
                              {issue.description ?? UNKNOWN}
                            </span>
                            <span className="flex items-center gap-2">
                              <StatusBadge
                                spec={{
                                  ...issueBadge(issue.status),
                                  label: ISSUE_STATUS_LABEL[issue.status],
                                }}
                              />
                              <span className="text-xs text-ink-secondary">
                                {issue.client_visible ? "Visible to them" : "Internal only"}
                              </span>
                            </span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>
            </>
          )}

          {tab === "orders" && (
            <div className="col-span-12">
              <DataTable
                caption={`Orders for ${d.client.name}`}
                columns={orderColumns}
                rows={d.orders}
                rowKey={(o) => o.id}
                onRowClick={(o) => router.push(`/orders/${o.id}`)}
                defaultSort={{ columnId: "raised", direction: "desc" }}
                empty={
                  <EmptyState
                    icon={<PackageSearch />}
                    title="No orders yet"
                    description="Orders appear here once this client sends a basket to Noor."
                  />
                }
              />
            </div>
          )}

          {tab === "finance" && (
            <>
              <div className="col-span-5 flex flex-col gap-4">
                <Card title="Balance">
                  <dl className="flex flex-col gap-3 text-sm">
                    <Row
                      label="Invoiced"
                      value={formatMoneyFull(balance.invoiced, balance.currency)}
                      hint={`${formatCount(d.invoices.length)} invoices`}
                    />
                    <Row
                      label="Paid"
                      value={formatMoneyFull(balance.paid, balance.currency)}
                      hint={`${formatCount(d.payments.length)} payments`}
                    />
                    <Row
                      label="Credited"
                      value={formatMoneyFull(balance.credited, balance.currency)}
                      hint={`${formatCount(d.creditNotes.length)} credit notes`}
                    />
                    <div className="border-t border-line-divider pt-3">
                      <Row
                        label="Outstanding"
                        value={formatMoneyFull(balance.outstanding, balance.currency)}
                        hint={
                          balance.overdue > 0
                            ? `${formatMoneyFull(balance.overdue, balance.currency)} past its due date`
                            : undefined
                        }
                      />
                    </div>
                  </dl>
                </Card>

                <Card title="Credit notes">
                  {d.creditNotes.length === 0 ? (
                    <p className="text-sm text-ink-secondary">None issued.</p>
                  ) : (
                    <ul className="flex flex-col gap-3">
                      {d.creditNotes.map((c) => (
                        <li key={c.id} className="flex items-start justify-between gap-3">
                          <span className="flex min-w-0 flex-col">
                            <span className="truncate text-sm font-medium text-ink">
                              {c.number}
                            </span>
                            <span className="truncate text-xs text-ink-secondary">
                              {c.reason ?? UNKNOWN}
                            </span>
                          </span>
                          <span className="shrink-0 text-sm tabular-nums text-ink">
                            {formatMoneyFull(Number(c.amount ?? 0), c.currency ?? currency)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </Card>
              </div>

              <div className="col-span-7">
                <Card title="Ledger" flush className="h-full">
                  <DataTable
                    className="rounded-none border-0"
                    caption={`Ledger entries for ${d.client.name}`}
                    columns={ledgerColumns}
                    rows={d.ledger}
                    rowKey={(l) => l.id}
                    defaultSort={{ columnId: "date", direction: "desc" }}
                    empty={
                      <EmptyState
                        icon={<PackageSearch />}
                        title="Nothing on the ledger"
                        description="Invoices, payments and credit notes post here as they are raised."
                      />
                    }
                  />
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
