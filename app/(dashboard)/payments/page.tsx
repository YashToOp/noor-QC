"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Banknote, Plus } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog } from "@/components/ui/dialog";
import { DataTable, type Column } from "@/components/ui/data-table";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { MetricSkeleton, TableSkeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import {
  useClients,
  useCreditNotes,
  useInvoices,
  usePayments,
  useTenant,
  useDisplayCurrency,
  qk,
} from "@/lib/queries";
import { useNow } from "@/lib/realtime";
import { clientBalance } from "@/lib/profile";
import { isoDate, recordPayment } from "@/lib/finance";
import type { Payment } from "@/lib/types";
import { formatCount, formatDate, formatMoney, formatMoneyFull, UNKNOWN } from "@/lib/format";
import { MixedCurrencyNotice } from "@/components/profile/profile-bits";

/**
 * PAYMENTS — money in.
 *
 * Recording one writes the `payments` row and its `ledger_entries` row, so the
 * client's balance moves with it. `method` is free text in the schema; the
 * options here are the values the seed uses, kept as a select so the ledger
 * description stays consistent rather than becoming a spelling exercise.
 */
const METHODS = [
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "cash", label: "Cash" },
  { value: "cheque", label: "Cheque" },
  { value: "letter_of_credit", label: "Letter of credit" },
];

export default function PaymentsPage() {
  const qc = useQueryClient();
  const toast = useToast();
  const now = useNow();
  const nowMs = now || Date.now();

  const payments = usePayments();
  const invoices = useInvoices();
  const creditNotes = useCreditNotes();
  const clients = useClients();
  const tenant = useTenant();
  const display = useDisplayCurrency();

  const [recording, setRecording] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [clientId, setClientId] = React.useState("");
  const [amount, setAmount] = React.useState("");
  const [method, setMethod] = React.useState("bank_transfer");
  const [reference, setReference] = React.useState("");
  const [receivedAt, setReceivedAt] = React.useState("");

  const clientById = React.useMemo(
    () => new Map((clients.data ?? []).map((c) => [c.id, c])),
    [clients.data],
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

  const loading = payments.isLoading || invoices.isLoading;

  /** Money received inside the last 30 days — the cash-in pulse. */
  const last30 = React.useMemo(() => {
    const cutoff = nowMs - 30 * 86_400_000;
    return (payments.data ?? [])
      .filter((p) => p.received_at && new Date(p.received_at).getTime() >= cutoff)
      .reduce((sum, p) => sum + Number(p.amount ?? 0), 0);
  }, [payments.data, nowMs]);

  const submit = async () => {
    const tenantId = tenant.data?.id;
    if (!tenantId || !clientId || !amount.trim()) return;
    setBusy(true);
    try {
      await recordPayment({
        tenantId,
        clientId,
        amount: Number(amount),
        currency: clientById.get(clientId)?.currency ?? display,
        method,
        reference: reference.trim() || null,
        receivedAt: receivedAt || isoDate(new Date(nowMs)),
      });
      qc.invalidateQueries({ queryKey: qk.payments });
      qc.invalidateQueries({ queryKey: qk.clientProfile(clientId) });
      toast({
        tone: "success",
        title: `${formatMoneyFull(Number(amount), clientById.get(clientId)?.currency ?? display)} recorded`,
      });
      setRecording(false);
      setClientId("");
      setAmount("");
      setReference("");
      setReceivedAt("");
    } catch (e) {
      toast({ tone: "error", title: "Couldn't record the payment", description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  const columns: Column<Payment>[] = [
    {
      id: "received",
      header: "Received",
      primary: true,
      render: (p) => formatDate(p.received_at),
      sortValue: (p) => new Date(p.received_at ?? 0).getTime(),
      width: "140px",
    },
    {
      id: "client",
      header: "Client",
      render: (p) => (p.client_id ? clientById.get(p.client_id)?.name ?? UNKNOWN : UNKNOWN),
      sortValue: (p) => (p.client_id ? clientById.get(p.client_id)?.name ?? "" : ""),
    },
    {
      id: "method",
      header: "Method",
      render: (p) => (
        <span className="inline-flex h-5 items-center rounded-sm bg-well px-1.5 text-xs font-medium text-ink-secondary">
          {METHODS.find((m) => m.value === p.method)?.label ?? p.method ?? UNKNOWN}
        </span>
      ),
      sortValue: (p) => p.method ?? "",
      width: "160px",
    },
    {
      id: "reference",
      header: "Reference",
      render: (p) => p.reference ?? <span className="text-ink-disabled">—</span>,
      sortValue: (p) => p.reference ?? "",
    },
    {
      id: "amount",
      header: "Amount",
      numeric: true,
      render: (p) => formatMoneyFull(Number(p.amount ?? 0), p.currency),
      sortValue: (p) => Number(p.amount ?? 0),
      width: "140px",
    },
  ];

  return (
    <>
      <PageHeader
        title="Payments"
        actions={
          <Button variant="secondary" icon={<Plus />} onClick={() => setRecording(true)}>
            Record payment
          </Button>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto pt-3">
        <div className="grid grid-cols-12 items-stretch gap-4 pb-4">
          <MixedCurrencyNotice
            currencies={[
              ...(invoices.data ?? []).map((i) => i.currency),
              ...(payments.data ?? []).map((p) => p.currency),
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
                title="Received all time"
                value={formatMoney(balance.paid, balance.currency)}
                comparison={`${formatCount(payments.data?.length ?? 0)} payments`}
              />
              <MetricCard
                className="col-span-3"
                title="Received last 30 days"
                value={formatMoney(last30, balance.currency)}
                comparison="cash in, rolling month"
              />
              <MetricCard
                className="col-span-3"
                title="Still outstanding"
                value={formatMoney(balance.outstanding, balance.currency)}
                comparison="across every client"
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
            {payments.isError ? (
              <Card title="Payments">
                <ErrorState
                  thing="the payment list"
                  reason={(payments.error as Error)?.message}
                  onRetry={() => payments.refetch()}
                />
              </Card>
            ) : loading ? (
              <div className="overflow-hidden rounded-xl border-hairline border-line bg-surface">
                <TableSkeleton rows={5} cols={5} />
              </div>
            ) : (
              <DataTable
                caption="Payments received from clients"
                columns={columns}
                rows={payments.data ?? []}
                rowKey={(p) => p.id}
                defaultSort={{ columnId: "received", direction: "desc" }}
                empty={
                  <EmptyState
                    icon={<Banknote />}
                    title="No payments recorded"
                    description="Recording one here also posts it to the client's ledger."
                    action={{ label: "Record a payment", onClick: () => setRecording(true) }}
                  />
                }
              />
            )}
          </div>
        </div>
      </div>

      <Dialog
        open={recording}
        onClose={() => setRecording(false)}
        width={560}
        title="Record a payment"
        description="The payment is written first, then its ledger entry — so the client's balance and ledger stay in step."
        footer={
          <>
            <Button variant="ghost" onClick={() => setRecording(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              disabled={!clientId || !amount.trim() || Number(amount) <= 0}
              loading={busy}
              onClick={submit}
            >
              Record payment
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <Select
            label="Client"
            value={clientId}
            onChange={setClientId}
            placeholder="Choose a client"
            options={(clients.data ?? []).map((c) => ({ value: c.id, label: c.name }))}
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
            <Input
              label="Received on"
              type="date"
              value={receivedAt}
              onChange={(e) => setReceivedAt(e.target.value)}
              helper="Defaults to today"
            />
          </div>
          <Select label="Method" value={method} onChange={setMethod} options={METHODS} />
          <Input
            label="Reference"
            placeholder="Bank reference, cheque number"
            value={reference}
            onChange={(e) => setReference(e.target.value)}
          />
        </div>
      </Dialog>
    </>
  );
}
