"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useClients, useEnquiries, useOrders } from "@/lib/queries";
import { enquiryBadge } from "@/lib/status";
import type { Enquiry, ManufacturerOrder } from "@/lib/types";
import { formatCount, formatDate, formatMoney, UNKNOWN } from "@/lib/format";

/**
 * ENQUIRIES — read-only, and that is the correct scope.
 *
 * The write map is unambiguous: Majlis **creates** enquiries when a client
 * sends a basket to Noor, and nobody else writes them. So this board shows what
 * came in and what it turned into — `manufacturer_orders.enquiry_id` is the
 * link — and offers no way to edit a client's own request.
 */
export default function EnquiriesPage() {
  const router = useRouter();
  const enquiries = useEnquiries();
  const orders = useOrders();
  const clients = useClients();
  const [status, setStatus] = React.useState("all");

  const clientById = React.useMemo(
    () => new Map((clients.data ?? []).map((c) => [c.id, c])),
    [clients.data],
  );

  /** What each enquiry became: the orders raised from it. */
  const ordersByEnquiry = React.useMemo(() => {
    const map = new Map<string, ManufacturerOrder[]>();
    for (const o of orders.data ?? []) {
      if (!o.enquiry_id) continue;
      const bucket = map.get(o.enquiry_id);
      if (bucket) bucket.push(o);
      else map.set(o.enquiry_id, [o]);
    }
    return map;
  }, [orders.data]);

  const rows = React.useMemo(() => {
    const all = enquiries.data ?? [];
    return status === "all" ? all : all.filter((e) => e.status === status);
  }, [enquiries.data, status]);

  const columns: Column<Enquiry>[] = [
    {
      id: "number",
      header: "Enquiry",
      primary: true,
      render: (e) => e.number,
      sortValue: (e) => e.number,
      width: "148px",
    },
    {
      id: "client",
      header: "Client",
      render: (e) => (e.client_id ? clientById.get(e.client_id)?.name ?? UNKNOWN : UNKNOWN),
      sortValue: (e) => (e.client_id ? clientById.get(e.client_id)?.name ?? "" : ""),
    },
    {
      id: "submitted",
      header: "Submitted",
      render: (e) =>
        e.submitted_at ? formatDate(e.submitted_at) : <span className="text-ink-disabled">—</span>,
      sortValue: (e) => new Date(e.submitted_at ?? 0).getTime(),
      width: "140px",
    },
    {
      id: "window",
      header: "Delivery wanted",
      render: (e) =>
        e.requested_delivery_from ? (
          `${formatDate(e.requested_delivery_from)} – ${formatDate(e.requested_delivery_to)}`
        ) : (
          <span className="text-ink-disabled">—</span>
        ),
      sortValue: (e) => new Date(e.requested_delivery_from ?? 0).getTime(),
      width: "220px",
    },
    {
      id: "orders",
      header: "Orders raised",
      numeric: true,
      render: (e) => formatCount(ordersByEnquiry.get(e.id)?.length ?? 0),
      sortValue: (e) => ordersByEnquiry.get(e.id)?.length ?? 0,
      width: "132px",
    },
    {
      id: "value",
      header: "Value",
      numeric: true,
      render: (e) => {
        const os = ordersByEnquiry.get(e.id) ?? [];
        if (!os.length) return <span className="text-ink-disabled">—</span>;
        return formatMoney(
          os.reduce((sum, o) => sum + Number(o.total ?? 0), 0),
          os[0].currency,
        );
      },
      sortValue: (e) =>
        (ordersByEnquiry.get(e.id) ?? []).reduce((sum, o) => sum + Number(o.total ?? 0), 0),
      width: "120px",
    },
    {
      id: "status",
      header: "Status",
      render: (e) => <StatusBadge spec={enquiryBadge(e.status)} dot />,
      sortValue: (e) => enquiryBadge(e.status).label,
      width: "128px",
    },
  ];

  const statusOptions = [
    { value: "all", label: "All enquiries" },
    ...["draft", "submitted", "quoting", "quoted", "closed"].map((s) => ({
      value: s,
      label: enquiryBadge(s).label,
    })),
  ];

  return (
    <>
      <PageHeader title="Enquiries" />

      <div className="my-3 flex shrink-0 items-center justify-between gap-2">
        <Select className="w-[200px]" value={status} onChange={setStatus} options={statusOptions} />
        <span className="text-xs text-ink-secondary">
          Created by the client in Majlis — read-only here.
        </span>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {enquiries.isError ? (
          <Card title="Enquiries">
            <ErrorState
              thing="the enquiry board"
              reason={(enquiries.error as Error)?.message}
              onRetry={() => enquiries.refetch()}
            />
          </Card>
        ) : enquiries.isLoading ? (
          <div className="overflow-hidden rounded-xl border-hairline border-line bg-surface">
            <TableSkeleton rows={5} cols={6} />
          </div>
        ) : (
          <DataTable
            caption="Enquiries received from clients"
            columns={columns}
            rows={rows}
            rowKey={(e) => e.id}
            onRowClick={(e) => {
              const first = ordersByEnquiry.get(e.id)?.[0];
              if (first) router.push(`/orders/${first.id}`);
            }}
            defaultSort={{ columnId: "submitted", direction: "desc" }}
            empty={
              <EmptyState
                icon={<FileText />}
                title="No enquiries"
                description="An enquiry arrives when a client sends a basket to Noor from Majlis."
                action={{ label: "View all orders", onClick: () => router.push("/orders") }}
              />
            }
          />
        )}
      </div>
    </>
  );
}
