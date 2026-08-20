"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { PackageSearch } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { ScopeBar, useScope } from "@/components/shell/scope-bar";
import { Select } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Pagination } from "@/components/ui/pagination";
import { TableSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { Card } from "@/components/ui/card";
import { useClients, useHouses, useOrders } from "@/lib/queries";
import { orderBadge, STATUS_LABEL } from "@/lib/status";
import type { ManufacturerOrder, MoStatus } from "@/lib/types";
import { formatDate, formatMoney, UNKNOWN } from "@/lib/format";

/**
 * ORDERS — the live board. Every order, filterable, with realtime status
 * updates arriving through the `manufacturer_orders` subscription mounted in
 * the dashboard layout.
 *
 * Table spec is §5.7; pagination sits outside the scroll area in the h-12
 * footer the same section describes.
 */
export default function OrdersPage() {
  const router = useRouter();
  const { scope, setRange, setHouseId } = useScope("fy");

  const orders = useOrders();
  const clients = useClients();
  const houses = useHouses();

  const [status, setStatus] = React.useState("all");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(25);

  const clientName = new Map((clients.data ?? []).map((c) => [c.id, c.name]));
  const houseName = new Map((houses.data ?? []).map((h) => [h.id, h.name]));

  const filtered = React.useMemo(() => {
    return (orders.data ?? []).filter((o) => {
      if (scope.houseId !== "all" && o.house_id !== scope.houseId) return false;
      if (status !== "all" && o.status !== status) return false;
      const created = new Date(o.created_at).getTime();
      return created >= scope.range.from.getTime() && created <= scope.range.to.getTime();
    });
  }, [orders.data, scope.houseId, scope.range, status]);

  // Keep the page in range when a filter shrinks the result set.
  React.useEffect(() => {
    setPage(1);
  }, [status, scope.houseId, scope.range, pageSize]);

  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  const statusOptions = [
    { value: "all", label: "All statuses" },
    ...(Object.keys(STATUS_LABEL) as MoStatus[]).map((s) => ({
      value: s,
      label: STATUS_LABEL[s],
    })),
  ];

  const columns: Column<ManufacturerOrder>[] = [
    {
      id: "number",
      header: "Order",
      primary: true,
      render: (o) => o.number,
      sortValue: (o) => o.number,
      width: "128px",
    },
    {
      id: "client",
      header: "Client",
      render: (o) => (o.client_id ? clientName.get(o.client_id) ?? UNKNOWN : UNKNOWN),
      sortValue: (o) => (o.client_id ? clientName.get(o.client_id) ?? "" : ""),
    },
    {
      id: "house",
      header: "House",
      render: (o) => (o.house_id ? houseName.get(o.house_id) ?? UNKNOWN : UNKNOWN),
      sortValue: (o) => (o.house_id ? houseName.get(o.house_id) ?? "" : ""),
    },
    {
      id: "stage",
      header: "State",
      render: (o) => STATUS_LABEL[o.status],
      sortValue: (o) => STATUS_LABEL[o.status],
    },
    {
      id: "promised",
      header: "Promised ship",
      render: (o) => (o.promised_ship_date ? formatDate(o.promised_ship_date) : UNKNOWN),
      sortValue: (o) => o.promised_ship_date ?? "",
      width: "148px",
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

  return (
    <>
      <PageHeader title="All orders" />

      <ScopeBar
        scope={scope}
        onRangeChange={setRange}
        onHouseChange={setHouseId}
        actions={
          <Select
            className="w-[180px]"
            value={status}
            onChange={setStatus}
            options={statusOptions}
          />
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {orders.isError ? (
          <Card title="Orders">
            <ErrorState
              thing="the order board"
              reason={(orders.error as Error)?.message}
              onRetry={() => orders.refetch()}
            />
          </Card>
        ) : orders.isLoading ? (
          <div className="overflow-hidden rounded-xl border-hairline border-line bg-surface">
            <TableSkeleton rows={8} cols={7} />
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border-hairline border-line bg-surface">
            <DataTable
              className="rounded-none border-0"
              caption="All manufacturer orders"
              columns={columns}
              rows={pageRows}
              rowKey={(o) => o.id}
              onRowClick={(o) => router.push(`/orders/${o.id}`)}
              defaultSort={{ columnId: "number", direction: "asc" }}
              empty={
                <EmptyState
                  icon={<PackageSearch />}
                  title="No orders match this scope"
                  description="Widen the date range, or clear the house and status filters."
                  action={{ label: "Clear status filter", onClick: () => setStatus("all") }}
                />
              }
            />
            <Pagination
              page={page}
              pageSize={pageSize}
              total={filtered.length}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </div>
    </>
  );
}
