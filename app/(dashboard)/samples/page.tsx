"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { MoreHorizontal, Palette, Plus } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Dialog } from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { TableSkeleton } from "@/components/ui/skeleton";
import { StatusBadge } from "@/components/ui/status-badge";
import { useToast } from "@/components/ui/toast";
import { useAllReviews, useApprovals, useClients, useOrders, qk } from "@/lib/queries";
import { openGate } from "@/lib/gates";
import { APPROVAL_TYPE_LABEL, approvalBadge } from "@/lib/status";
import type { Approval } from "@/lib/types";
import { formatDate, UNKNOWN } from "@/lib/format";

/**
 * SAMPLES & SHADES — the approvals board.
 *
 * `approvals` is the sample/shade record: a lab dip, a pre-production sample, a
 * size set. Majlis writes the client's *decision*; this dashboard decides when
 * a sample is put in front of them, and that decision is the `sample_release`
 * gate — so the row's action opens or follows that gate rather than inventing a
 * second way to release the same thing.
 */
export default function SamplesPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();

  const approvals = useApprovals();
  const orders = useOrders();
  const clients = useClients();
  const reviews = useAllReviews();

  const [status, setStatus] = React.useState("all");
  const [raising, setRaising] = React.useState(false);
  const [raiseOrderId, setRaiseOrderId] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  const orderById = React.useMemo(
    () => new Map((orders.data ?? []).map((o) => [o.id, o])),
    [orders.data],
  );
  const clientById = React.useMemo(
    () => new Map((clients.data ?? []).map((c) => [c.id, c])),
    [clients.data],
  );

  /** The open sample gate per order, so a row can link straight to the decision. */
  const openSampleGate = React.useMemo(() => {
    const byOrder = new Map<string, string>();
    for (const r of reviews.data ?? []) {
      if (r.gate_type === "sample_release" && !r.decided_at) {
        byOrder.set(r.manufacturer_order_id, r.id);
      }
    }
    return byOrder;
  }, [reviews.data]);

  const rows = React.useMemo(() => {
    const all = approvals.data ?? [];
    return status === "all" ? all : all.filter((a) => a.status === status);
  }, [approvals.data, status]);

  const raiseGate = async () => {
    const order = (orders.data ?? []).find((o) => o.id === raiseOrderId);
    if (!order) return;
    setBusy(true);
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
      setBusy(false);
    }
  };

  const columns: Column<Approval>[] = [
    {
      id: "title",
      header: "Sample",
      primary: true,
      render: (a) => a.title ?? UNKNOWN,
      sortValue: (a) => a.title ?? "",
    },
    {
      id: "type",
      header: "Type",
      render: (a) => (
        <span className="inline-flex h-5 items-center rounded-sm bg-well px-1.5 text-xs font-medium text-ink-secondary">
          {APPROVAL_TYPE_LABEL[a.type] ?? a.type}
        </span>
      ),
      sortValue: (a) => a.type,
      width: "180px",
    },
    {
      id: "order",
      header: "Order",
      render: (a) =>
        a.manufacturer_order_id ? orderById.get(a.manufacturer_order_id)?.number ?? UNKNOWN : UNKNOWN,
      sortValue: (a) =>
        a.manufacturer_order_id ? orderById.get(a.manufacturer_order_id)?.number ?? "" : "",
      width: "140px",
    },
    {
      id: "client",
      header: "Client",
      render: (a) => {
        const order = a.manufacturer_order_id ? orderById.get(a.manufacturer_order_id) : null;
        return order?.client_id ? clientById.get(order.client_id)?.name ?? UNKNOWN : UNKNOWN;
      },
      sortValue: (a) => {
        const order = a.manufacturer_order_id ? orderById.get(a.manufacturer_order_id) : null;
        return order?.client_id ? clientById.get(order.client_id)?.name ?? "" : "";
      },
    },
    {
      id: "swatch",
      header: "Swatch",
      render: (a) =>
        a.swatch_ref ? (
          <span className="tabular-nums">{a.swatch_ref}</span>
        ) : (
          <span className="text-ink-disabled">—</span>
        ),
      sortValue: (a) => a.swatch_ref ?? "",
      width: "112px",
    },
    {
      id: "lighting",
      header: "Lighting",
      render: (a) => a.lighting ?? <span className="text-ink-disabled">—</span>,
      sortValue: (a) => a.lighting ?? "",
      width: "160px",
    },
    {
      id: "due",
      header: "Due",
      render: (a) => (a.due_at ? formatDate(a.due_at) : <span className="text-ink-disabled">—</span>),
      sortValue: (a) => new Date(a.due_at ?? 0).getTime(),
      width: "132px",
    },
    {
      id: "status",
      header: "Status",
      render: (a) => <StatusBadge spec={approvalBadge(a.status)} dot />,
      sortValue: (a) => approvalBadge(a.status).label,
      width: "148px",
    },
    {
      id: "actions",
      header: "Actions",
      actions: true,
      render: (a) => {
        const gateId = a.manufacturer_order_id ? openSampleGate.get(a.manufacturer_order_id) : null;
        return (
          <DropdownMenu
            label="Actions for this sample"
            trigger={
              <Button variant="ghost" className="size-8 p-0">
                <MoreHorizontal className="size-4" aria-hidden />
              </Button>
            }
            items={[
              ...(gateId
                ? [{ label: "Open the sample gate", onSelect: () => router.push(`/gates/${gateId}`) }]
                : []),
              ...(a.manufacturer_order_id
                ? [
                    {
                      label: "View order",
                      onSelect: () => router.push(`/orders/${a.manufacturer_order_id}`),
                    },
                  ]
                : []),
            ]}
          />
        );
      },
    },
  ];

  const statusOptions = [
    { value: "all", label: "All samples" },
    ...["pending", "approved", "revision_requested", "conditional", "superseded", "expired"].map(
      (s) => ({ value: s, label: approvalBadge(s).label }),
    ),
  ];

  const raisableOrders = (orders.data ?? []).filter(
    (o) => !["declined", "cancelled", "closed", "quoting"].includes(o.status),
  );

  return (
    <>
      <PageHeader title="Samples & shades" />

      <div className="my-3 flex shrink-0 items-center justify-between gap-2">
        <Select className="w-[200px]" value={status} onChange={setStatus} options={statusOptions} />
        <Button variant="secondary" icon={<Plus />} onClick={() => setRaising(true)}>
          Raise sample gate
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        {approvals.isError ? (
          <Card title="Samples">
            <ErrorState
              thing="the sample board"
              reason={(approvals.error as Error)?.message}
              onRetry={() => approvals.refetch()}
            />
          </Card>
        ) : approvals.isLoading ? (
          <div className="overflow-hidden rounded-xl border-hairline border-line bg-surface">
            <TableSkeleton rows={5} cols={7} />
          </div>
        ) : (
          <DataTable
            caption="Samples and shades awaiting or holding a decision"
            columns={columns}
            rows={rows}
            rowKey={(a) => a.id}
            defaultSort={{ columnId: "due", direction: "asc" }}
            empty={
              <EmptyState
                icon={<Palette />}
                title="No samples on record"
                description="Lab dips, pre-production samples and size sets appear here. Raising a sample gate is what puts one in front of the client."
                action={{ label: "Raise a sample gate", onClick: () => setRaising(true) }}
              />
            }
          />
        )}
      </div>

      <Dialog
        open={raising}
        onClose={() => setRaising(false)}
        title="Raise a sample gate"
        description="Approving the gate moves the sample to pending, which is what puts it on the client's phone."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRaising(false)}>
              Cancel
            </Button>
            <Button variant="primary" disabled={!raiseOrderId} loading={busy} onClick={raiseGate}>
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
