"use client";

import * as React from "react";
import { Boxes } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Tabs } from "@/components/ui/tabs";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { useClients, useDisplayCurrency, useMasters, useStyles, type Masters } from "@/lib/queries";
import { formatCount, formatDate, formatDuration, formatMoneyFull, UNKNOWN } from "@/lib/format";

/**
 * MASTERS — the reference data every other screen reads.
 *
 * Read-only by design. The write map marks all of this "seeded": the stage
 * ladder, issue types and price lists are shared with Majlis and Sharik, and a
 * dashboard that let one operator rename a production stage would silently
 * change what the other two apps display. Showing it matters — half the
 * numbers on this dashboard are derived from these rows, and being able to
 * point at the SLA hours or the stage durations is what makes them checkable.
 */
const TABS = [
  { id: "stages", label: "Production stages" },
  { id: "issues", label: "Issue types" },
  { id: "categories", label: "Categories" },
  { id: "styles", label: "Styles" },
  { id: "packs", label: "Ratio packs" },
  { id: "prices", label: "Price lists" },
];

export default function MastersPage() {
  const masters = useMasters();
  const styles = useStyles();
  const display = useDisplayCurrency();
  const clients = useClients();
  const [tab, setTab] = React.useState("stages");

  const clientById = React.useMemo(
    () => new Map((clients.data ?? []).map((c) => [c.id, c])),
    [clients.data],
  );
  const styleById = React.useMemo(
    () => new Map((styles.data ?? []).map((s) => [s.id, s])),
    [styles.data],
  );

  const stageColumns: Column<Masters["stages"][number]>[] = [
    { id: "sort", header: "#", numeric: true, render: (s) => s.sort, sortValue: (s) => s.sort, width: "64px" },
    { id: "name", header: "Stage", primary: true, render: (s) => s.name, sortValue: (s) => s.name },
    { id: "code", header: "Code", render: (s) => s.code, sortValue: (s) => s.code, width: "140px" },
    {
      id: "duration",
      header: "Typical duration",
      numeric: true,
      render: (s) =>
        s.typical_duration_days == null ? UNKNOWN : `${formatCount(s.typical_duration_days)} days`,
      sortValue: (s) => s.typical_duration_days ?? 0,
      width: "160px",
    },
    {
      id: "media",
      header: "Needs evidence",
      render: (s) => (s.requires_media ? "Yes" : "No"),
      sortValue: (s) => (s.requires_media ? 1 : 0),
      width: "148px",
    },
    {
      id: "visible",
      header: "Client sees it",
      render: (s) => (s.client_visible ? "Yes" : "No"),
      sortValue: (s) => (s.client_visible ? 1 : 0),
      width: "140px",
    },
  ];

  const issueTypeColumns: Column<Masters["issueTypes"][number]>[] = [
    { id: "name", header: "Issue type", primary: true, render: (t) => t.name, sortValue: (t) => t.name },
    {
      id: "category",
      header: "Category",
      render: (t) => t.category ?? UNKNOWN,
      sortValue: (t) => t.category ?? "",
      width: "160px",
    },
    { id: "code", header: "Code", render: (t) => t.code, sortValue: (t) => t.code, width: "180px" },
    {
      id: "sla",
      header: "SLA",
      numeric: true,
      render: (t) => (t.sla_hours == null ? UNKNOWN : formatDuration(t.sla_hours * 3_600_000)),
      sortValue: (t) => t.sla_hours ?? 0,
      width: "140px",
    },
  ];

  const categoryColumns: Column<Masters["categories"][number]>[] = [
    { id: "sort", header: "#", numeric: true, render: (c) => c.sort ?? 0, sortValue: (c) => c.sort ?? 0, width: "64px" },
    { id: "name", header: "Category", primary: true, render: (c) => c.name, sortValue: (c) => c.name },
    { id: "code", header: "Code", render: (c) => c.code, sortValue: (c) => c.code, width: "180px" },
  ];

  const styleColumns: Column<NonNullable<typeof styles.data>[number]>[] = [
    { id: "code", header: "Code", primary: true, render: (s) => s.code, sortValue: (s) => s.code, width: "140px" },
    { id: "name", header: "Style", render: (s) => s.name, sortValue: (s) => s.name },
    {
      id: "fabric",
      header: "Fabric",
      render: (s) => s.fabric ?? UNKNOWN,
      sortValue: (s) => s.fabric ?? "",
    },
    {
      id: "moq",
      header: "MOQ",
      numeric: true,
      render: (s) => (s.moq_packs == null ? UNKNOWN : `${formatCount(s.moq_packs)} packs`),
      sortValue: (s) => s.moq_packs ?? 0,
      width: "132px",
    },
    {
      id: "lead",
      header: "Lead time",
      numeric: true,
      render: (s) => (s.lead_time_days == null ? UNKNOWN : `${formatCount(s.lead_time_days)} days`),
      sortValue: (s) => s.lead_time_days ?? 0,
      width: "132px",
    },
    {
      id: "price",
      header: "Base price",
      numeric: true,
      render: (s) =>
        s.base_price == null ? UNKNOWN : formatMoneyFull(Number(s.base_price), s.currency ?? display),
      sortValue: (s) => Number(s.base_price ?? 0),
      width: "132px",
    },
  ];

  const packColumns: Column<Masters["ratioPacks"][number]>[] = [
    { id: "name", header: "Pack", primary: true, render: (p) => p.name, sortValue: (p) => p.name, width: "180px" },
    {
      id: "style",
      header: "Style",
      render: (p) => (p.style_id ? styleById.get(p.style_id)?.name ?? UNKNOWN : UNKNOWN),
      sortValue: (p) => (p.style_id ? styleById.get(p.style_id)?.name ?? "" : ""),
    },
    {
      id: "ratio",
      header: "Ratio",
      render: (p) => (
        <span className="tabular-nums">
          {typeof p.ratio === "object" && p.ratio
            ? Object.entries(p.ratio as Record<string, number>)
                .map(([size, n]) => `${size}:${n}`)
                .join("  ")
            : UNKNOWN}
        </span>
      ),
      sortValue: (p) => JSON.stringify(p.ratio ?? ""),
    },
    {
      id: "pcs",
      header: "Pieces / pack",
      numeric: true,
      render: (p) => formatCount(p.pcs_per_pack),
      sortValue: (p) => p.pcs_per_pack ?? 0,
      width: "140px",
    },
    {
      id: "default",
      header: "Default",
      render: (p) => (p.is_default ? "Yes" : "No"),
      sortValue: (p) => (p.is_default ? 1 : 0),
      width: "104px",
    },
  ];

  const priceColumns: Column<Masters["priceLists"][number]>[] = [
    {
      id: "style",
      header: "Style",
      primary: true,
      render: (p) => (p.style_id ? styleById.get(p.style_id)?.name ?? UNKNOWN : UNKNOWN),
      sortValue: (p) => (p.style_id ? styleById.get(p.style_id)?.name ?? "" : ""),
    },
    {
      id: "client",
      header: "Client",
      render: (p) =>
        p.client_id ? clientById.get(p.client_id)?.name ?? UNKNOWN : "All clients",
      sortValue: (p) => (p.client_id ? clientById.get(p.client_id)?.name ?? "" : ""),
    },
    {
      id: "price",
      header: "Price",
      numeric: true,
      render: (p) => (p.price == null ? UNKNOWN : formatMoneyFull(Number(p.price), p.currency)),
      sortValue: (p) => Number(p.price ?? 0),
      width: "132px",
    },
    {
      id: "from",
      header: "Valid from",
      render: (p) => (p.valid_from ? formatDate(p.valid_from) : UNKNOWN),
      sortValue: (p) => new Date(p.valid_from ?? 0).getTime(),
      width: "140px",
    },
    {
      id: "to",
      header: "Valid to",
      render: (p) => (p.valid_to ? formatDate(p.valid_to) : "Open ended"),
      sortValue: (p) => new Date(p.valid_to ?? 0).getTime(),
      width: "140px",
    },
  ];

  const empty = (what: string) => (
    <EmptyState icon={<Boxes />} title={`No ${what}`} description="Nothing is seeded here yet." />
  );

  if (masters.isError) {
    return (
      <>
        <PageHeader title="Masters" />
        <Card title="Masters">
          <ErrorState
            thing="the reference data"
            reason={(masters.error as Error)?.message}
            onRetry={() => masters.refetch()}
          />
        </Card>
      </>
    );
  }

  const m = masters.data;

  return (
    <>
      <PageHeader
        title="Masters"
        actions={
          <span className="text-xs text-ink-secondary">
            Shared with Majlis and Sharik — read-only here.
          </span>
        }
      />

      <Tabs tabs={TABS} active={tab} onChange={setTab} className="shrink-0" />

      <div className="min-h-0 flex-1 overflow-y-auto pt-4 pb-4">
        {masters.isLoading || !m ? (
          <div className="overflow-hidden rounded-xl border-hairline border-line bg-surface">
            <TableSkeleton rows={6} cols={5} />
          </div>
        ) : tab === "stages" ? (
          <DataTable
            caption="Production stages"
            columns={stageColumns}
            rows={m.stages}
            rowKey={(s) => s.id}
            defaultSort={{ columnId: "sort", direction: "asc" }}
            empty={empty("stages")}
          />
        ) : tab === "issues" ? (
          <DataTable
            caption="Issue types and their SLAs"
            columns={issueTypeColumns}
            rows={m.issueTypes}
            rowKey={(t) => t.id}
            defaultSort={{ columnId: "name", direction: "asc" }}
            empty={empty("issue types")}
          />
        ) : tab === "categories" ? (
          <DataTable
            caption="Product categories"
            columns={categoryColumns}
            rows={m.categories}
            rowKey={(c) => c.id}
            defaultSort={{ columnId: "sort", direction: "asc" }}
            empty={empty("categories")}
          />
        ) : tab === "styles" ? (
          <DataTable
            caption="Style catalogue"
            columns={styleColumns}
            rows={styles.data ?? []}
            rowKey={(s) => s.id}
            defaultSort={{ columnId: "code", direction: "asc" }}
            empty={empty("styles")}
          />
        ) : tab === "packs" ? (
          <DataTable
            caption="Ratio packs"
            columns={packColumns}
            rows={m.ratioPacks}
            rowKey={(p) => p.id}
            defaultSort={{ columnId: "name", direction: "asc" }}
            empty={empty("ratio packs")}
          />
        ) : (
          <DataTable
            caption="Client price lists"
            columns={priceColumns}
            rows={m.priceLists}
            rowKey={(p) => p.id}
            defaultSort={{ columnId: "style", direction: "asc" }}
            empty={empty("price lists")}
          />
        )}
      </div>
    </>
  );
}
