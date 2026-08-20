"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Receipt } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { Tabs } from "@/components/ui/tabs";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { MetricSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import {
  useClients,
  useCreditNotes,
  useInvoices,
  useOrders,
  usePayments,
  useTenant,
  useDisplayCurrency,
  qk,
} from "@/lib/queries";
import { useNow } from "@/lib/realtime";
import { useRouter } from "next/navigation";
import { useEnquiries } from "@/lib/queries";
import { invoiceStage } from "@/lib/invoice";
import { clientBalance } from "@/lib/profile";
import { isoDate, nextDocumentNumber, recordCreditNote, recordInvoice } from "@/lib/finance";
import type { CreditNote, Invoice, ManufacturerOrder } from "@/lib/types";
import { formatCount, formatDate, formatMoney, formatMoneyFull, UNKNOWN } from "@/lib/format";
import { MixedCurrencyNotice } from "@/components/profile/profile-bits";
import { cn } from "@/lib/utils";

/**
 * INVOICES — receivables, and the one place invoices and credit notes are
 * raised.
 *
 * The write map gives this dashboard `invoices` and `credit_notes` outright.
 * Each document also posts its `ledger_entries` row, because the schema has no
 * triggers and nothing else would — see the note at the top of lib/finance.ts.
 */
const TABS = [
  { id: "batches", label: "By enquiry" },
  { id: "invoices", label: "Invoices" },
  { id: "credits", label: "Credit notes" },
];

export default function InvoicesPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const now = useNow();
  const nowMs = now || Date.now();

  const invoices = useInvoices();
  const payments = usePayments();
  const creditNotes = useCreditNotes();
  const clients = useClients();
  const orders = useOrders();
  const tenant = useTenant();
  const display = useDisplayCurrency();
  const router = useRouter();
  const enquiries = useEnquiries();

  const [tab, setTab] = React.useState("batches");
  const [raising, setRaising] = React.useState<null | "invoice" | "credit">(null);
  const [busy, setBusy] = React.useState(false);

  const [clientId, setClientId] = React.useState("");
  const [orderId, setOrderId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [dueAt, setDueAt] = React.useState("");
  const [note, setNote] = React.useState("");

  const clientById = React.useMemo(
    () => new Map((clients.data ?? []).map((c) => [c.id, c])),
    [clients.data],
  );
  const orderById = React.useMemo(
    () => new Map((orders.data ?? []).map((o) => [o.id, o])),
    [orders.data],
  );

  const balance = React.useMemo(
    () =>
      clientBalance(
        invoices.data ?? [],
        payments.data ?? [],
        creditNotes.data ?? [],
        nowMs,
        display,
      ),
    [invoices.data, payments.data, creditNotes.data, display, nowMs],
  );

  const loading = invoices.isLoading || payments.isLoading;

  const isOverdue = (i: Invoice) =>
    Boolean(i.due_at && new Date(`${i.due_at}T23:59:59`).getTime() < nowMs);

  const resetForm = () => {
    setClientId("");
    setOrderId("");
    setAmount("");
    setDueAt("");
    setNote("");
  };

  const submit = async () => {
    const tenantId = tenant.data?.id;
    if (!tenantId || !clientId || !amount.trim()) return;
    const client = clientById.get(clientId);
    const currency = client?.currency ?? display;
    const today = isoDate(new Date(nowMs));

    setBusy(true);
    try {
      if (raising === "invoice") {
        const number = nextDocumentNumber(
          "INV",
          (invoices.data ?? []).map((i) => i.number),
          new Date(nowMs).getFullYear(),
        );
        await recordInvoice({
          tenantId,
          clientId,
          orderId: orderId || null,
          number,
          amount: Number(amount),
          currency,
          issuedAt: today,
          dueAt: dueAt || null,
          description: note.trim() || `Invoice ${number}`,
        });
        toast({ tone: "success", title: `${number} raised` });
      } else {
        const number = nextDocumentNumber(
          "CN",
          (creditNotes.data ?? []).map((c) => c.number),
          new Date(nowMs).getFullYear(),
        );
        await recordCreditNote({
          tenantId,
          clientId,
          orderId: orderId || null,
          issueId: null,
          number,
          amount: Number(amount),
          currency,
          reason: note.trim() || "Credit note",
          issuedAt: today,
        });
        toast({ tone: "success", title: `${number} issued` });
      }

      qc.invalidateQueries({ queryKey: qk.invoices });
      qc.invalidateQueries({ queryKey: qk.creditNotes });
      qc.invalidateQueries({ queryKey: qk.clientProfile(clientId) });
      setRaising(null);
      resetForm();
    } catch (e) {
      toast({ tone: "error", title: "Couldn't record that", description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  /**
   * One row per enquiry — the customer's "I ordered from four manufacturers"
   * view. Each becomes N invoices, one per manufacturer order.
   */
  const batchRows = React.useMemo(() => {
    const byEnquiry = new Map<string, ManufacturerOrder[]>();
    for (const o of orders.data ?? []) {
      if (!o.enquiry_id) continue;
      const bucket = byEnquiry.get(o.enquiry_id);
      if (bucket) bucket.push(o);
      else byEnquiry.set(o.enquiry_id, [o]);
    }
    return (enquiries.data ?? [])
      .filter((e) => byEnquiry.has(e.id))
      .map((e) => {
        const os = byEnquiry.get(e.id)!;
        return {
          enquiry: e,
          manufacturers: new Set(os.map((o) => o.house_id)).size,
          awaiting: os.filter((o) => invoiceStage(o.status) === "awaiting_approval").length,
          sent: os.filter((o) => invoiceStage(o.status) === "sent").length,
          value: os.reduce((sum, o) => sum + Number(o.total ?? 0), 0),
          currency: os[0]?.currency ?? display,
        };
      });
  }, [enquiries.data, orders.data, display]);

  type BatchRow = (typeof batchRows)[number];

  const batchColumns: Column<BatchRow>[] = [
    {
      id: "number",
      header: "Enquiry",
      primary: true,
      render: (r) => r.enquiry.number,
      sortValue: (r) => r.enquiry.number,
      width: "160px",
    },
    {
      id: "client",
      header: "Customer",
      render: (r) =>
        r.enquiry.client_id ? clientById.get(r.enquiry.client_id)?.name ?? UNKNOWN : UNKNOWN,
      sortValue: (r) =>
        r.enquiry.client_id ? clientById.get(r.enquiry.client_id)?.name ?? "" : "",
    },
    {
      id: "manufacturers",
      header: "Manufacturers",
      numeric: true,
      render: (r) => formatCount(r.manufacturers),
      sortValue: (r) => r.manufacturers,
      width: "148px",
    },
    {
      id: "awaiting",
      header: "Awaiting you",
      numeric: true,
      render: (r) =>
        r.awaiting === 0 ? <span className="text-ink-disabled">—</span> : formatCount(r.awaiting),
      sortValue: (r) => r.awaiting,
      width: "140px",
    },
    {
      id: "sent",
      header: "Sent",
      numeric: true,
      render: (r) => formatCount(r.sent),
      sortValue: (r) => r.sent,
      width: "104px",
    },
    {
      id: "value",
      header: "Value",
      numeric: true,
      render: (r) => formatMoney(r.value, r.currency),
      sortValue: (r) => r.value,
      width: "140px",
    },
  ];

  const invoiceColumns: Column<Invoice>[] = [
    {
      id: "number",
      header: "Invoice",
      primary: true,
      render: (i) => i.number,
      sortValue: (i) => i.number,
      width: "160px",
    },
    {
      id: "client",
      header: "Client",
      render: (i) => (i.client_id ? clientById.get(i.client_id)?.name ?? UNKNOWN : UNKNOWN),
      sortValue: (i) => (i.client_id ? clientById.get(i.client_id)?.name ?? "" : ""),
    },
    {
      id: "order",
      header: "Order",
      render: (i) =>
        i.manufacturer_order_id ? (
          orderById.get(i.manufacturer_order_id)?.number ?? UNKNOWN
        ) : (
          <span className="text-ink-disabled">—</span>
        ),
      sortValue: (i) =>
        i.manufacturer_order_id ? orderById.get(i.manufacturer_order_id)?.number ?? "" : "",
      width: "148px",
    },
    {
      id: "issued",
      header: "Issued",
      render: (i) => formatDate(i.issued_at),
      sortValue: (i) => new Date(i.issued_at ?? 0).getTime(),
      width: "132px",
    },
    {
      id: "due",
      header: "Due",
      render: (i) =>
        i.due_at ? (
          // Overdue carries a word, never the colour alone (§8).
          <span className={cn(isOverdue(i) && "font-medium text-[#8c1a20]")}>
            {formatDate(i.due_at)}
            {isOverdue(i) && " · overdue"}
          </span>
        ) : (
          <span className="text-ink-disabled">—</span>
        ),
      sortValue: (i) => new Date(i.due_at ?? 0).getTime(),
      width: "180px",
    },
    {
      id: "amount",
      header: "Amount",
      numeric: true,
      render: (i) => formatMoneyFull(Number(i.amount ?? 0), i.currency),
      sortValue: (i) => Number(i.amount ?? 0),
      width: "140px",
    },
  ];

  const creditColumns: Column<CreditNote>[] = [
    {
      id: "number",
      header: "Credit note",
      primary: true,
      render: (c) => c.number,
      sortValue: (c) => c.number,
      width: "160px",
    },
    {
      id: "client",
      header: "Client",
      render: (c) => (c.client_id ? clientById.get(c.client_id)?.name ?? UNKNOWN : UNKNOWN),
      sortValue: (c) => (c.client_id ? clientById.get(c.client_id)?.name ?? "" : ""),
    },
    {
      id: "reason",
      header: "Reason",
      render: (c) => c.reason ?? UNKNOWN,
      sortValue: (c) => c.reason ?? "",
    },
    {
      id: "issued",
      header: "Issued",
      render: (c) => formatDate(c.issued_at),
      sortValue: (c) => new Date(c.issued_at ?? 0).getTime(),
      width: "132px",
    },
    {
      id: "amount",
      header: "Amount",
      numeric: true,
      render: (c) => formatMoneyFull(Number(c.amount ?? 0), c.currency),
      sortValue: (c) => Number(c.amount ?? 0),
      width: "140px",
    },
  ];

  const clientOrders = (orders.data ?? []).filter((o) => !clientId || o.client_id === clientId);

  return (
    <>
      <PageHeader
        title="Invoices"
        actions={
          <Button
            variant="secondary"
            icon={<Plus />}
            onClick={() => {
              resetForm();
              setRaising(tab === "credits" ? "credit" : "invoice");
            }}
          >
            {tab === "credits" ? "Issue credit note" : "Raise invoice"}
          </Button>
        }
      />

      <Tabs tabs={TABS} active={tab} onChange={setTab} className="shrink-0" />

      <div className="min-h-0 flex-1 overflow-y-auto pt-4">
        <div className="grid grid-cols-12 items-stretch gap-4 pb-4">
          <MixedCurrencyNotice
            currencies={[
              ...(invoices.data ?? []).map((i) => i.currency),
              ...(payments.data ?? []).map((p) => p.currency),
              ...(creditNotes.data ?? []).map((c) => c.currency),
            ]}
            display={display}
          />
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
                title="Invoiced"
                value={formatMoney(balance.invoiced, balance.currency)}
                comparison={`${formatCount(invoices.data?.length ?? 0)} invoices`}
              />
              <MetricCard
                className="col-span-3"
                title="Received"
                value={formatMoney(balance.paid, balance.currency)}
                comparison={`${formatCount(payments.data?.length ?? 0)} payments`}
              />
              <MetricCard
                className="col-span-3"
                title="Outstanding"
                value={formatMoney(balance.outstanding, balance.currency)}
                comparison="invoiced less paid and credited"
              />
              <MetricCard
                className="col-span-3"
                title="Overdue"
                value={formatMoney(balance.overdue, balance.currency)}
                comparison="capped at what is still owed"
              />
            </>
          )}

          <div className="col-span-12">
            {invoices.isError ? (
              <Card title="Invoices">
                <ErrorState
                  thing="the invoice list"
                  reason={(invoices.error as Error)?.message}
                  onRetry={() => invoices.refetch()}
                />
              </Card>
            ) : loading ? (
              <div className="overflow-hidden rounded-xl border-hairline border-line bg-surface">
                <TableSkeleton rows={5} cols={6} />
              </div>
            ) : tab === "batches" ? (
              <DataTable
                caption="Enquiries and the invoices they produce, one per manufacturer"
                columns={batchColumns}
                rows={batchRows}
                rowKey={(r) => r.enquiry.id}
                onRowClick={(r) => router.push(`/invoices/batch/${r.enquiry.id}`)}
                defaultSort={{ columnId: "number", direction: "desc" }}
                empty={
                  <EmptyState
                    icon={<Receipt />}
                    title="No enquiries with orders"
                    description="An enquiry spanning four manufacturers becomes four invoices, one each."
                  />
                }
              />
            ) : tab === "invoices" ? (
              <DataTable
                caption="Invoices raised against clients"
                columns={invoiceColumns}
                rows={invoices.data ?? []}
                rowKey={(i) => i.id}
                onRowClick={(i) => router.push(`/invoices/bill/${i.id}`)}
                defaultSort={{ columnId: "issued", direction: "desc" }}
                empty={
                  <EmptyState
                    icon={<Receipt />}
                    title="No invoices yet"
                    description="Raising one here also posts it to the client's ledger."
                    action={{
                      label: "Raise an invoice",
                      onClick: () => {
                        resetForm();
                        setRaising("invoice");
                      },
                    }}
                  />
                }
              />
            ) : (
              <DataTable
                caption="Credit notes issued to clients"
                columns={creditColumns}
                rows={creditNotes.data ?? []}
                rowKey={(c) => c.id}
                defaultSort={{ columnId: "issued", direction: "desc" }}
                empty={
                  <EmptyState
                    icon={<Receipt />}
                    title="No credit notes"
                    description="A credit note reduces what a client owes, usually to settle an issue."
                    action={{
                      label: "Issue a credit note",
                      onClick: () => {
                        resetForm();
                        setRaising("credit");
                      },
                    }}
                  />
                }
              />
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={raising !== null}
        onClose={() => setRaising(null)}
        width={560}
        title={raising === "credit" ? "Issue a credit note" : "Raise an invoice"}
        description="The document is written first, then its ledger entry — so the client's balance and ledger stay in step."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRaising(null)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!clientId || !amount.trim() || Number(amount) <= 0}
              loading={busy}
              onClick={submit}
            >
              {raising === "credit" ? "Issue credit note" : "Raise invoice"}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Select
            label="Client"
            value={clientId}
            onChange={(v) => {
              setClientId(v);
              setOrderId("");
            }}
            placeholder="Choose a client"
            options={(clients.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
          />
          <Select
            label="Against order (optional)"
            value={orderId}
            onChange={setOrderId}
            placeholder="No specific order"
            options={clientOrders.map((o) => ({ value: o.id, label: o.number }))}
          />
          <div className="flex gap-3">
            <Input
              label={`Amount (${clientById.get(clientId)?.currency ?? display})`}
              type="number"
              min={0}
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
            {raising === "invoice" && (
              <Input
                label="Due date"
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
              />
            )}
          </div>
          <Input
            label={raising === "credit" ? "Reason" : "Ledger description"}
            placeholder={
              raising === "credit" ? "Why this is being credited" : "What this invoice covers"
            }
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
      </Dialog>
    </>
  );
}
