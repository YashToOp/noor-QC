"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Download, Send } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { InvoiceSheet } from "@/components/invoice/invoice-sheet";
import { useInvoiceBatch, useDisplayCurrency, qk } from "@/lib/queries";
import {
  buildInvoiceDoc,
  invoiceStage,
  STAGE_EXPLAIN,
  STAGE_LABEL,

  type InvoiceStage,
} from "@/lib/invoice";
import { CHECKS_BY_TYPE, decideGate, openGate } from "@/lib/gates";
import { isoDate, nextDocumentNumber, recordInvoice } from "@/lib/finance";
import { formatCount, formatMoneyFull, UNKNOWN } from "@/lib/format";
import type { ChecklistState } from "@/lib/types";

/**
 * THE INVOICE BATCH — one enquiry, one invoice per manufacturer.
 *
 * This is the customer's flow end to end: a basket spanning four houses
 * produces four invoices, they download instantly, we approve, and approving
 * is what sends each order to its manufacturer.
 *
 * Approving does not invent a second approval mechanism. It decides each
 * order's existing `order_review` gate, which is the write that moves the
 * order to `released` — the exact moment Sharik can see it. One button, four
 * gates, the same state machine as the queue.
 */
const STAGE_TONE: Record<InvoiceStage, Parameters<typeof StatusBadge>[0]["spec"]> = {
  not_ready: { tone: "draft", label: STAGE_LABEL.not_ready },
  awaiting_approval: { tone: "pending", label: STAGE_LABEL.awaiting_approval },
  sent: { tone: "active", label: STAGE_LABEL.sent },
  rejected: { tone: "rejected", label: STAGE_LABEL.rejected },
};

export default function InvoiceBatchPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();
  const display = useDisplayCurrency();

  const batch = useInvoiceBatch(params.id);
  const [confirming, setConfirming] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  const docs = React.useMemo(() => {
    const b = batch.data;
    if (!b) return [];
    return b.orders.map((entry) => ({
      entry,
      doc: buildInvoiceDoc({
        tenant: b.tenant,
        order: entry.order,
        client: b.client,
        house: entry.house,
        lines: entry.lines,
        styles: b.styles,
        colourways: b.colourways,
        media: b.media,
        invoice: entry.invoice,
      }),
      stage: invoiceStage(entry.order.status),
    }));
  }, [batch.data]);

  const sendable = docs.filter((d) => d.stage === "awaiting_approval");
  const blocked = docs.filter((d) => d.stage === "not_ready");

  const download = () => window.print();

  /**
   * Approve every invoice that is ready, and send its order to the house.
   *
   * For each: make sure the order-review gate exists, then decide it passed.
   * `decideGate` creates the production ladder and flips the order to
   * `released` — so the manufacturer sees the order the moment this returns.
   */
  const approveAll = async () => {
    const b = batch.data;
    if (!b) return;
    setBusy(true);

    const failures: string[] = [];
    for (const { entry, doc } of sendable) {
      try {
        const review = entry.review ?? (await openGate(entry.order, "order_review"));

        // The operator is affirming the checklist for the batch; record it as
        // confirmed rather than writing a decision over blank checks.
        const checks: ChecklistState = Object.fromEntries(
          CHECKS_BY_TYPE.order_review.map((c) => [c.key, true]),
        );

        await decideGate({
          review,
          order: entry.order,
          outcome: "passed",
          checks,
          note: `Approved with invoice batch ${b.enquiry?.number ?? ""}`.trim(),
          stages: b.stages,
          totalPcs: doc.totalPcs,
        });

        // File the invoice if it was never raised, so the money side matches
        // the document the client was handed.
        if (!entry.invoice && b.client && b.tenant) {
          await recordInvoice({
            tenantId: b.tenant.id,
            clientId: b.client.id,
            orderId: entry.order.id,
            number: nextDocumentNumber(
              "INV",
              docs.map((d) => d.entry.invoice?.number ?? "").filter(Boolean),
              new Date().getFullYear(),
            ),
            amount: doc.total,
            currency: doc.currency,
            issuedAt: isoDate(new Date()),
            dueAt: null,
            description: `Order ${entry.order.number} — ${entry.house?.name ?? "house"}`,
          });
        }
      } catch (e) {
        failures.push(`${entry.order.number}: ${(e as Error).message}`);
      }
    }

    qc.invalidateQueries({ queryKey: qk.invoiceBatch(params.id) });
    qc.invalidateQueries({ queryKey: qk.orders });
    qc.invalidateQueries({ queryKey: qk.gateQueue });
    qc.invalidateQueries({ queryKey: qk.reviews });
    qc.invalidateQueries({ queryKey: qk.invoices });
    qc.invalidateQueries({ queryKey: qk.events });

    setBusy(false);
    setConfirming(false);

    if (failures.length) {
      toast({
        tone: "error",
        title: `${formatCount(failures.length)} of ${formatCount(sendable.length)} could not be sent`,
        description: failures[0],
      });
    } else {
      toast({
        tone: "success",
        title: `${formatCount(sendable.length)} orders released`,
        description: "Each manufacturer can now see their order.",
      });
    }
  };

  if (batch.isError) {
    return (
      <>
        <PageHeader title="Invoices" breadcrumb={[{ label: "Invoices", href: "/invoices" }]} />
        <Card title="Invoice batch">
          <ErrorState
            thing="this invoice batch"
            reason={(batch.error as Error)?.message}
            onRetry={() => batch.refetch()}
          />
        </Card>
      </>
    );
  }

  if (batch.isLoading || !batch.data) {
    return (
      <>
        <PageHeader title="Invoices" breadcrumb={[{ label: "Invoices", href: "/invoices" }]} />
        <div className="pt-3">
          <Card title=" " className="h-[420px]">
            <Skeleton className="h-full w-full" />
          </Card>
        </div>
      </>
    );
  }

  const b = batch.data;
  const grandTotal = docs.reduce((sum, d) => sum + d.doc.total, 0);

  return (
    <>
      <PageHeader
        title={`${b.enquiry?.number ?? "Invoices"} · ${formatCount(docs.length)} manufacturers`}
        breadcrumb={[{ label: "Invoices", href: "/invoices" }]}
        actions={
          <>
            <Button variant="secondary" icon={<Download />} onClick={download}>
              Download all
            </Button>
            <Button
              variant="primary"
              icon={<Send />}
              disabled={sendable.length === 0}
              onClick={() => setConfirming(true)}
            >
              Approve &amp; send {sendable.length > 0 ? `(${formatCount(sendable.length)})` : ""}
            </Button>
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto pt-3">
        {docs.length === 0 ? (
          <Card title="Invoice batch">
            <EmptyState
              icon={<AlertTriangle />}
              title="No orders on this enquiry"
              description="An invoice exists per manufacturer order. This enquiry has none yet."
              action={{ label: "Back to invoices", onClick: () => router.push("/invoices") }}
            />
          </Card>
        ) : (
          <div className="flex flex-col gap-4 pb-4">
            {/* Summary — outside the print region, so paper starts at the document. */}
            <Card title="This batch">
              <div className="flex flex-col gap-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-sm text-ink-secondary">
                    {b.client?.name ?? UNKNOWN} · {formatCount(docs.length)} invoices
                  </span>
                  <span className="text-sm font-medium tabular-nums text-ink">
                    {formatMoneyFull(grandTotal, docs[0]?.doc.currency ?? display)}
                  </span>
                </div>
                <ul className="flex flex-col gap-2 border-t border-line-divider pt-3">
                  {docs.map(({ entry, doc, stage }) => (
                    <li key={entry.order.id} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">
                          {entry.house?.name ?? UNKNOWN}
                        </span>
                        <span className="block truncate text-xs text-ink-secondary">
                          {entry.order.number} · {STAGE_EXPLAIN[stage]}
                        </span>
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-ink">
                        {formatMoneyFull(doc.total, doc.currency)}
                      </span>
                      <span className="w-[190px] shrink-0 text-right">
                        <StatusBadge spec={STAGE_TONE[stage]} dot />
                      </span>
                    </li>
                  ))}
                </ul>

                {blocked.length > 0 && (
                  <p className="flex items-start gap-2 rounded-lg bg-well p-3 text-xs text-ink-secondary">
                    <AlertTriangle
                      className="mt-0.5 size-3.5 shrink-0 text-state-warning"
                      aria-hidden
                    />
                    <span>
                      {formatCount(blocked.length)} of these cannot be sent yet — an order still
                      being quoted or negotiated has not reached the review gate. Approving sends
                      the {formatCount(sendable.length)} that have.
                    </span>
                  </p>
                )}
              </div>
            </Card>

            {/* The documents themselves — this is what prints. */}
            <div className="print-region flex flex-col gap-4">
              {docs.map(({ entry, doc }) => (
                <div
                  key={entry.order.id}
                  className="overflow-hidden rounded-xl border-hairline border-line bg-white print:rounded-none print:border-0"
                >
                  <InvoiceSheet doc={doc} />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog
        open={confirming}
        onClose={() => setConfirming(false)}
        width={560}
        title={`Approve ${formatCount(sendable.length)} invoices and send to the manufacturers`}
        description="This decides each order's review gate, creates its production ladder, and releases it — which is the moment each house can see their order."
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={busy} onClick={approveAll}>
              Approve &amp; send
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-3">
          <ul className="flex flex-col gap-1.5 rounded-lg bg-well p-3">
            {sendable.map(({ entry, doc }) => (
              <li key={entry.order.id} className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-sm text-ink">
                  {entry.house?.name ?? UNKNOWN}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-ink-secondary">
                  {formatMoneyFull(doc.total, doc.currency)}
                </span>
              </li>
            ))}
          </ul>
          <p className="text-xs text-ink-secondary">
            You are confirming the order-review checklist for each of these. To work through the
            six checks individually instead, open each gate from the queue.
          </p>
        </div>
      </Dialog>
    </>
  );
}

