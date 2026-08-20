"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, EyeOff, MoreHorizontal, Users } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { ScopeBar, useScope } from "@/components/shell/scope-bar";
import { MetricCard } from "@/components/ui/metric-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { Sheet } from "@/components/ui/sheet";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { MetricSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { ChartCard } from "@/components/charts/chart-card";
import { RankedBarChart } from "@/components/charts/ranked-bar-chart";
import {
  useClients,
  useHouses,
  useIssueTypes,
  useIssues,
  useOrders,
  qk,
} from "@/lib/queries";
import { useNow } from "@/lib/realtime";
import {
  ISSUE_STATUS_LABEL,
  SLA_COLOUR,
  SLA_LABEL,
  canReject,
  isOpen,
  nextAction,
  slaDueAt,
  slaState,
  transitionIssue,
} from "@/lib/issues";
import { issueBadge } from "@/lib/status";
import type { Issue, IssueStatus, IssueType } from "@/lib/types";
import {
  delta,
  issueCostAtRiskAt,
  medianResolutionHours,
  openIssuesAt,
  previousWindow,
  slaBreachedAt,
  type Kpi,
} from "@/lib/metrics";
import {
  formatCount,
  formatDate,
  formatDateTime,
  formatDuration,
  formatMoney,
  formatMoneyFull,
  formatWaiting,
  UNKNOWN,
} from "@/lib/format";

/**
 * ISSUES — the resolution desk.
 *
 * The write map gives this dashboard one verb on `issues`: resolve. Majlis and
 * Sharik raise them; this page walks them along the `issue_status` ladder and
 * records what the fix cost. Layout is the §7.2 dashboard pattern — scope bar,
 * KPI row, a pair of breakdowns, then the actionable table.
 *
 * `client_visible` is shown on every row and never editable here: whoever
 * raised the issue decided whether the client sees it, and changing that from
 * the resolver's chair would rewrite what the client was told. Being able to
 * point at an internal issue the client never sees is the distinction worth
 * showing in the demo.
 */
export default function IssuesPage() {
  const router = useRouter();
  const now = useNow();
  const qc = useQueryClient();
  const toast = useToast();
  const { scope, setRange, setHouseId } = useScope("fy");

  const issues = useIssues();
  const types = useIssueTypes();
  const houses = useHouses();
  const clients = useClients();
  const orders = useOrders();

  const [statusFilter, setStatusFilter] = React.useState("open");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  const [proposing, setProposing] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [resolution, setResolution] = React.useState("");
  const [cost, setCost] = React.useState("");
  const [days, setDays] = React.useState("");

  const typeById = React.useMemo(
    () => new Map((types.data ?? []).map((t) => [t.id, t])),
    [types.data],
  );
  const houseById = React.useMemo(
    () => new Map((houses.data ?? []).map((h) => [h.id, h])),
    [houses.data],
  );
  const clientById = React.useMemo(
    () => new Map((clients.data ?? []).map((c) => [c.id, c])),
    [clients.data],
  );
  const orderById = React.useMemo(
    () => new Map((orders.data ?? []).map((o) => [o.id, o])),
    [orders.data],
  );

  const nowMs = now || Date.now();
  const currency = (orders.data ?? [])[0]?.currency ?? "USD";

  const typeOf = React.useCallback(
    (issue: Issue): IssueType | null =>
      issue.issue_type_id ? typeById.get(issue.issue_type_id) ?? null : null,
    [typeById],
  );

  /** Issues inside the current scope, before the status filter. */
  const scoped = React.useMemo(() => {
    return (issues.data ?? []).filter((i) => {
      if (scope.houseId !== "all" && i.house_id !== scope.houseId) return false;
      if (!i.raised_at) return true;
      const raised = new Date(i.raised_at).getTime();
      return raised >= scope.range.from.getTime() && raised <= scope.range.to.getTime();
    });
  }, [issues.data, scope.houseId, scope.range]);

  const rows = React.useMemo(() => {
    const filtered = scoped.filter((i) => {
      if (statusFilter === "all") return true;
      if (statusFilter === "open") return isOpen(i);
      return i.status === statusFilter;
    });
    // Oldest first — the same discipline as the gate queue.
    return [...filtered].sort(
      (a, b) => new Date(a.raised_at ?? 0).getTime() - new Date(b.raised_at ?? 0).getTime(),
    );
  }, [scoped, statusFilter]);

  const kpis = React.useMemo(() => {
    const all = issues.data ?? [];
    const prev = previousWindow(scope.range);
    const prevMs = prev.to.getTime();
    const dueAt = (i: Issue) => slaDueAt(i, typeOf(i));

    const open: Kpi = {
      value: openIssuesAt(all, nowMs),
      previous: openIssuesAt(all, prevMs),
    };
    const breaching: Kpi = {
      value: slaBreachedAt(all, dueAt, nowMs),
      previous: slaBreachedAt(all, dueAt, prevMs),
    };
    const atRisk: Kpi = {
      value: issueCostAtRiskAt(all, nowMs),
      previous: issueCostAtRiskAt(all, prevMs),
    };
    const median: Kpi = {
      value: medianResolutionHours(all, scope.range),
      previous: medianResolutionHours(all, prev),
    };
    return { open, breaching, atRisk, median };
  }, [issues.data, scope.range, nowMs, typeOf]);

  const byType = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of scoped) {
      const label = typeOf(i)?.name ?? "Other";
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()].map(([label, value]) => ({ label, value }));
  }, [scoped, typeOf]);

  const byHouse = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of scoped) {
      if (!i.house_id) continue;
      const label = houseById.get(i.house_id)?.name ?? UNKNOWN;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
    return [...counts.entries()].map(([label, value]) => ({ label, value }));
  }, [scoped, houseById]);

  const selected = rows.find((i) => i.id === selectedId) ?? null;
  const selectedType = selected ? typeOf(selected) : null;
  const action = selected ? nextAction(selected.status) : null;

  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.issues });
    qc.invalidateQueries({ queryKey: qk.orders });
  };

  const advance = async (to: IssueStatus, withResolution = false) => {
    if (!selected) return;
    setBusy(true);
    try {
      await transitionIssue({
        issue: selected,
        to,
        ...(withResolution
          ? {
              resolution: resolution.trim(),
              costImpact: cost.trim() === "" ? null : Number(cost),
              daysImpact: days.trim() === "" ? null : Number(days),
            }
          : {}),
      });
      refresh();
      toast({
        tone: "success",
        title:
          to === "resolved"
            ? "Issue resolved"
            : to === "rejected"
              ? "Issue rejected"
              : `Moved to ${ISSUE_STATUS_LABEL[to].toLowerCase()}`,
      });
      setProposing(false);
      setResolution("");
      setCost("");
      setDays("");
      if (to === "resolved" || to === "rejected") setSelectedId(null);
    } catch (e) {
      toast({ tone: "error", title: "Couldn't update the issue", description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const statusOptions = [
    { value: "open", label: "Open issues" },
    { value: "all", label: "All statuses" },
    ...(Object.keys(ISSUE_STATUS_LABEL) as IssueStatus[]).map((s) => ({
      value: s,
      label: ISSUE_STATUS_LABEL[s],
    })),
  ];

  const columns: Column<Issue>[] = [
    {
      id: "type",
      header: "Type",
      render: (i) => (
        <span className="inline-flex h-5 items-center rounded-sm bg-well px-1.5 text-xs font-medium text-ink-secondary">
          {typeOf(i)?.name ?? "Other"}
        </span>
      ),
      sortValue: (i) => typeOf(i)?.name ?? "",
      width: "148px",
    },
    {
      id: "order",
      header: "Order",
      primary: true, // the primary identifier column — 14px/500 #172131
      render: (i) =>
        i.manufacturer_order_id ? orderById.get(i.manufacturer_order_id)?.number ?? UNKNOWN : UNKNOWN,
      sortValue: (i) =>
        i.manufacturer_order_id ? orderById.get(i.manufacturer_order_id)?.number ?? "" : "",
      width: "132px",
    },
    {
      id: "house",
      header: "House",
      render: (i) => (i.house_id ? houseById.get(i.house_id)?.name ?? UNKNOWN : UNKNOWN),
      sortValue: (i) => (i.house_id ? houseById.get(i.house_id)?.name ?? "" : ""),
    },
    {
      id: "raised",
      header: "Raised",
      numeric: true,
      render: (i) => formatWaiting(i.raised_at, nowMs),
      sortValue: (i) => new Date(i.raised_at ?? 0).getTime(),
      width: "104px",
    },
    {
      id: "sla",
      header: "SLA",
      render: (i) => {
        const state = slaState(i, typeOf(i), nowMs);
        // The word carries the meaning; the colour only reinforces it (§8).
        return (
          <span className="text-xs font-medium" style={{ color: SLA_COLOUR[state] }}>
            {SLA_LABEL[state]}
          </span>
        );
      },
      sortValue: (i) => new Date(slaDueAt(i, typeOf(i)) ?? 0).getTime(),
      width: "104px",
    },
    {
      id: "impact",
      header: "Impact",
      numeric: true,
      render: (i) =>
        i.cost_impact == null ? (
          <span className="text-ink-disabled">—</span>
        ) : (
          formatMoney(Number(i.cost_impact), currency)
        ),
      sortValue: (i) => Number(i.cost_impact ?? 0),
      width: "104px",
    },
    {
      id: "visibility",
      header: "Visibility",
      render: (i) =>
        i.client_visible ? (
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-secondary">
            <Users className="size-3.5 shrink-0 text-ink-sub" aria-hidden />
            Client
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 text-xs text-ink-secondary">
            <EyeOff className="size-3.5 shrink-0 text-ink-sub" aria-hidden />
            Internal
          </span>
        ),
      sortValue: (i) => (i.client_visible ? "Client" : "Internal"),
      width: "116px",
    },
    {
      id: "status",
      header: "Status",
      render: (i) => (
        <StatusBadge spec={{ ...issueBadge(i.status), label: ISSUE_STATUS_LABEL[i.status] }} dot />
      ),
      sortValue: (i) => ISSUE_STATUS_LABEL[i.status],
      width: "132px",
    },
    {
      id: "actions",
      header: "Actions",
      actions: true,
      render: (i) => (
        <DropdownMenu
          label={`Actions for this issue`}
          trigger={
            <Button variant="ghost" className="size-8 p-0">
              <MoreHorizontal className="size-4" aria-hidden />
            </Button>
          }
          items={[
            { label: "Open issue", onSelect: () => setSelectedId(i.id) },
            ...(i.manufacturer_order_id
              ? [
                  {
                    label: "View order",
                    onSelect: () => router.push(`/orders/${i.manufacturer_order_id}`),
                  },
                ]
              : []),
          ]}
        />
      ),
    },
  ];

  const loading = issues.isLoading || types.isLoading;

  return (
    <>
      <PageHeader title="Issues" />

      <ScopeBar
        scope={scope}
        onRangeChange={setRange}
        onHouseChange={setHouseId}
        actions={
          <Select
            className="w-[180px]"
            value={statusFilter}
            onChange={setStatusFilter}
            options={statusOptions}
          />
        }
      />

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
                title="Open issues"
                value={formatCount(kpis.open.value)}
                unit="issues"
                delta={delta(kpis.open)}
                invert
                comparison="vs. previous period"
              />
              <MetricCard
                className="col-span-3"
                title="Breaching SLA"
                value={formatCount(kpis.breaching.value)}
                unit="issues"
                delta={delta(kpis.breaching)}
                invert
                comparison="open and past due"
              />
              <MetricCard
                className="col-span-3"
                title="Cost at risk"
                value={formatMoney(kpis.atRisk.value, currency)}
                delta={delta(kpis.atRisk)}
                invert
                comparison="on open issues"
              />
              <MetricCard
                className="col-span-3"
                title="Median time to resolve"
                value={
                  kpis.median.value === null
                    ? UNKNOWN
                    : formatDuration(kpis.median.value * 3_600_000)
                }
                delta={delta(kpis.median)}
                invert
                comparison="issues closed in range"
              />
            </>
          )}

          {/* Two half-width breakdowns — §4.6's col-span-6, both 290px so the
              row stays level. Ranked bars rather than lines: these are
              categorical comparisons, and the dataset is small (§6.3). */}
          <ChartCard
            className="col-span-6"
            title="Issues by type"
            height={290}
            rowHeaders={["Issues"]}
            rows={byType.map((d) => ({ label: d.label, values: [d.value] }))}
            filename="issues-by-type"
          >
            <RankedBarChart
              data={byType}
              name="Issues"
              ariaLabel="Issue count by type"
              valueFormatter={(v) => formatCount(Number(v))}
              maxLabelWidth={120}
            />
          </ChartCard>

          <ChartCard
            className="col-span-6"
            title="Issues by house"
            height={290}
            rowHeaders={["Issues"]}
            rows={byHouse.map((d) => ({ label: d.label, values: [d.value] }))}
            filename="issues-by-house"
          >
            <RankedBarChart
              data={byHouse}
              name="Issues"
              ariaLabel="Issue count by house"
              valueFormatter={(v) => formatCount(Number(v))}
              maxLabelWidth={120}
            />
          </ChartCard>

          <div className="col-span-12">
            {issues.isError ? (
              <Card title="Issues">
                <ErrorState
                  thing="the issue list"
                  reason={(issues.error as Error)?.message}
                  onRetry={() => issues.refetch()}
                />
              </Card>
            ) : loading ? (
              <div className="overflow-hidden rounded-xl border-hairline border-line bg-surface">
                <TableSkeleton rows={6} cols={8} />
              </div>
            ) : (
              <DataTable
                caption="Issues in scope, oldest first"
                columns={columns}
                rows={rows}
                rowKey={(i) => i.id}
                onRowClick={(i) => setSelectedId(i.id)}
                selectedKey={selectedId}
                empty={
                  <EmptyState
                    icon={<CheckCircle2 />}
                    title={
                      statusFilter === "open" ? "Nothing open" : "No issues match this scope"
                    }
                    description={
                      statusFilter === "open"
                        ? "Every issue raised against these orders has been settled. New ones arrive when a house or a client reports a problem."
                        : "Widen the date range, or clear the house and status filters."
                    }
                    action={
                      statusFilter === "open"
                        ? { label: "Show all issues", onClick: () => setStatusFilter("all") }
                        : { label: "Clear status filter", onClick: () => setStatusFilter("all") }
                    }
                  />
                }
              />
            )}
          </div>
        </div>
      </div>

      {/* Detail and resolution — a 640px side sheet (§5.9) so the list stays
          in view while the operator works a row. */}
      <Sheet
        open={selected !== null}
        onClose={() => setSelectedId(null)}
        width={640}
        title={selectedType?.name ?? "Issue"}
        footer={
          selected && isOpen(selected) ? (
            <>
              {canReject(selected.status) && (
                <Button
                  variant="destructive"
                  disabled={busy || proposing}
                  onClick={() => advance("rejected")}
                >
                  Reject
                </Button>
              )}
              {action && (
                <Button
                  variant="primary"
                  loading={busy && !proposing}
                  disabled={busy || proposing}
                  onClick={() =>
                    action.needsResolution ? setProposing(true) : advance(action.to)
                  }
                >
                  {action.label}
                </Button>
              )}
            </>
          ) : null
        }
      >
        {selected && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge
                spec={{
                  ...issueBadge(selected.status),
                  label: ISSUE_STATUS_LABEL[selected.status],
                }}
                dot
              />
              <span
                className="text-xs font-medium"
                style={{ color: SLA_COLOUR[slaState(selected, selectedType, nowMs)] }}
              >
                SLA {SLA_LABEL[slaState(selected, selectedType, nowMs)].toLowerCase()}
              </span>
            </div>

            <p className="rounded-lg bg-well p-3 text-sm text-ink">
              {selected.description ?? UNKNOWN}
            </p>

            <dl className="flex flex-col gap-3 text-sm">
              <Row
                label="Order"
                value={
                  selected.manufacturer_order_id
                    ? orderById.get(selected.manufacturer_order_id)?.number ?? UNKNOWN
                    : UNKNOWN
                }
              />
              <Row
                label="Client"
                value={
                  selected.client_id ? clientById.get(selected.client_id)?.name ?? UNKNOWN : UNKNOWN
                }
              />
              <Row
                label="House"
                value={
                  selected.house_id ? houseById.get(selected.house_id)?.name ?? UNKNOWN : UNKNOWN
                }
              />
              <Row label="Raised" value={formatDateTime(selected.raised_at)} />
              <Row
                label="Due"
                value={
                  slaDueAt(selected, selectedType)
                    ? formatDateTime(slaDueAt(selected, selectedType))
                    : UNKNOWN
                }
                hint={
                  !selected.sla_due_at && selectedType?.sla_hours
                    ? `Derived from the ${selectedType.sla_hours}h SLA on this issue type`
                    : undefined
                }
              />
              <Row
                label="Cost impact"
                value={
                  selected.cost_impact == null
                    ? UNKNOWN
                    : formatMoneyFull(Number(selected.cost_impact), currency)
                }
              />
              <Row
                label="Days impact"
                value={selected.days_impact == null ? UNKNOWN : formatCount(selected.days_impact)}
              />
              {selected.resolved_at && (
                <Row label="Closed" value={formatDateTime(selected.resolved_at)} />
              )}
            </dl>

            {/* Read-only by design — see the note at the top of this file. */}
            <div className="flex items-start gap-2 rounded-lg bg-well p-3">
              {selected.client_visible ? (
                <Users className="mt-0.5 size-4 shrink-0 text-ink-sub" aria-hidden />
              ) : (
                <EyeOff className="mt-0.5 size-4 shrink-0 text-ink-sub" aria-hidden />
              )}
              <span className="flex min-w-0 flex-col">
                <span className="text-sm font-medium text-ink">
                  {selected.client_visible ? "Visible to the client" : "Internal only"}
                </span>
                <span className="text-xs text-ink-secondary">
                  {selected.client_visible
                    ? "This appears on the client's timeline."
                    : "The client never sees this. Set when the issue was raised, and not changed here."}
                </span>
              </span>
            </div>

            {selected.resolution && (
              <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-ink-secondary">The fix</span>
                <p className="rounded-lg bg-well p-3 text-sm text-ink">{selected.resolution}</p>
              </div>
            )}

            {!isOpen(selected) && (
              <p className="text-xs text-ink-secondary">
                Closed {formatDate(selected.resolved_at)} — this issue is settled.
              </p>
            )}
          </div>
        )}
      </Sheet>

      <Dialog
        open={proposing}
        onClose={() => setProposing(false)}
        width={560}
        title="Propose a fix"
        description="Recorded against the issue and carried into the cost-at-risk figure."
        footer={
          <>
            <Button variant="ghost" onClick={() => setProposing(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!resolution.trim()}
              loading={busy}
              onClick={() => advance("proposed", true)}
            >
              Propose
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Textarea
            label="What will be done"
            placeholder="The fix, and who carries it out"
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            autoFocus
          />
          <div className="flex gap-3">
            <Input
              label={`Cost impact (${currency})`}
              type="number"
              min={0}
              placeholder="0"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
            <Input
              label="Days impact"
              type="number"
              min={0}
              placeholder="0"
              value={days}
              onChange={(e) => setDays(e.target.value)}
            />
          </div>
        </div>
      </Dialog>
    </>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-ink-secondary">{label}</dt>
      <dd className="min-w-0 text-right">
        <span className="block truncate font-medium text-ink">{value}</span>
        {hint && <span className="block text-xs text-ink-secondary">{hint}</span>}
      </dd>
    </div>
  );
}
