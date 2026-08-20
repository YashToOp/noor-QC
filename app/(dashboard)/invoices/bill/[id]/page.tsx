"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Building2, FileText, Receipt, Users } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityRail } from "@/components/profile/activity-rail";
import { Row } from "@/components/profile/profile-bits";
import { useBillDossier } from "@/lib/queries";
import { billFacts, buildBillLog } from "@/lib/bill";
import { orderBadge } from "@/lib/status";
import { formatCount, formatDate, formatDateTime, formatMoneyFull, UNKNOWN } from "@/lib/format";

/**
 * ONE BILL, END TO END.
 *
 * This is where a bill number lands. It answers the questions an operator with
 * a bill in their hand actually has, in the order they ask them: who bought it,
 * who sold it, who made it, when it was placed, **who confirmed it**, when it
 * went to the house — and then the whole log, forwards, including any issue and
 * when it was settled.
 *
 * Every fact here is read off a real timestamp. Where the record is silent —
 * nobody signed the gate, no payment is tied to this document — the page says
 * so instead of filling the gap.
 */
export default function BillPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const q = useBillDossier(params.id);

  const view = React.useMemo(() => {
    if (!q.data) return null;
    return { facts: billFacts(q.data), log: buildBillLog(q.data) };
  }, [q.data]);

  if (q.isError) {
    return (
      <>
        <PageHeader title="Bill" breadcrumb={[{ label: "Invoices", href: "/invoices" }]} />
        <Card title="Bill">
          <ErrorState
            thing="this bill"
            reason={(q.error as Error)?.message}
            onRetry={() => q.refetch()}
          />
        </Card>
      </>
    );
  }

  if (q.isLoading) {
    return (
      <>
        <PageHeader title="Bill" breadcrumb={[{ label: "Invoices", href: "/invoices" }]} />
        <div className="pt-3">
          <Card title=" " className="h-[420px]">
            <Skeleton className="h-full w-full" />
          </Card>
        </div>
      </>
    );
  }

  if (!q.data || !view) {
    return (
      <>
        <PageHeader title="Bill" breadcrumb={[{ label: "Invoices", href: "/invoices" }]} />
        <Card title="Bill">
          <EmptyState
            icon={<Receipt />}
            title="No such bill"
            description="Nothing in the ledger carries this id. Search again by the number printed on the document."
            action={{ label: "Back to invoices", onClick: () => router.push("/invoices") }}
          />
        </Card>
      </>
    );
  }

  const d = q.data;
  const { facts, log } = view;
  const currency = d.invoice.currency || "INR";
  const buyerContact = d.client
    ? [...d.people.values()].find(
        (u) => u.client_id === d.client!.id && u.role === "client_principal",
      ) ?? null
    : null;

  return (
    <>
      <PageHeader
        title={d.invoice.number}
        breadcrumb={[{ label: "Invoices", href: "/invoices" }]}
        actions={
          <>
            {d.order && <StatusBadge spec={orderBadge(d.order.status)} dot />}
            {d.order && (
              <Button variant="secondary" onClick={() => router.push(`/invoices/order/${d.order!.id}`)}>
                Open the document
              </Button>
            )}
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto pt-3">
        <div className="grid grid-cols-12 items-start gap-4 pb-4">
          {/* ── The two parties, and who made it ────────────────────────── */}
          <Card title="Buyer" className="col-span-4">
            <dl className="flex flex-col gap-2 text-sm">
              <Row label="Client" value={d.client?.name ?? UNKNOWN} hint={d.client?.code ?? undefined} />
              <Row
                label="Location"
                value={[d.client?.city, d.client?.country].filter(Boolean).join(", ") || UNKNOWN}
              />
              <Row
                label="Contact"
                value={buyerContact?.display_name ?? UNKNOWN}
                hint={buyerContact?.phone ?? undefined}
              />
            </dl>
            {d.client && (
              <Link
                href={`/clients/${d.client.id}`}
                className="inline-flex items-center gap-1.5 rounded-sm text-sm text-ink-secondary hover:text-ink"
              >
                <Users className="size-3.5" aria-hidden />
                Full client history
              </Link>
            )}
          </Card>

          <Card title="Seller" className="col-span-4">
            <dl className="flex flex-col gap-2 text-sm">
              <Row label="Billed by" value={d.tenant?.name ?? "Noor"} />
              <Row label="Made by" value={d.house?.name ?? UNKNOWN} hint={d.house?.code ?? undefined} />
              <Row
                label="House location"
                value={[d.house?.city, d.house?.country].filter(Boolean).join(", ") || UNKNOWN}
              />
            </dl>
            {d.house && (
              <Link
                href={`/houses/${d.house.id}`}
                className="inline-flex items-center gap-1.5 rounded-sm text-sm text-ink-secondary hover:text-ink"
              >
                <Building2 className="size-3.5" aria-hidden />
                Full house record
              </Link>
            )}
          </Card>

          <Card title="This bill" className="col-span-4">
            <dl className="flex flex-col gap-2 text-sm">
              <Row
                label="Amount"
                value={
                  <span className="tabular-nums">{formatMoneyFull(d.invoice.amount ?? 0, currency)}</span>
                }
              />
              <Row label="Issued" value={formatDate(d.invoice.issued_at)} />
              <Row label="Due" value={formatDate(d.invoice.due_at)} />
              <Row
                label="Order"
                value={
                  d.order ? (
                    <Link href={`/orders/${d.order.id}`} className="rounded-sm hover:opacity-80">
                      {d.order.number}
                    </Link>
                  ) : (
                    UNKNOWN
                  )
                }
                hint={d.lines.length ? `${formatCount(d.lines.length)} lines` : undefined}
              />
            </dl>
          </Card>

          {/* ── The four questions, answered flat ───────────────────────── */}
          <Card title="Where it has been" className="col-span-12">
            <dl className="grid grid-cols-4 gap-x-6 gap-y-2 text-sm">
              <Row label="Order placed" value={formatDateTime(facts.placedAt)} />
              <Row
                label="Confirmed by"
                value={facts.confirmedBy ?? "Not signed"}
                hint={
                  facts.confirmedAt
                    ? formatDateTime(facts.confirmedAt)
                    : facts.confirmedBy
                      ? undefined
                      : "The gate carries no reviewer"
                }
              />
              <Row
                label="Forwarded to the house"
                value={facts.forwardedAt ? formatDateTime(facts.forwardedAt) : "Not yet"}
                hint={facts.forwardedAt && d.house ? d.house.name : undefined}
              />
              <Row
                label="Issues"
                value={
                  facts.issuesOpen + facts.issuesResolved === 0
                    ? "None raised"
                    : `${formatCount(facts.issuesOpen)} open · ${formatCount(facts.issuesResolved)} resolved`
                }
              />
            </dl>
          </Card>

          {/* ── The log ─────────────────────────────────────────────────── */}
          <Card title={`Full log (${formatCount(log.length)})`} className="col-span-8">
            {log.length === 0 ? (
              <EmptyState
                icon={<FileText />}
                title="Nothing dated yet"
                description="This bill has no dated activity behind it."
              />
            ) : (
              <ActivityRail
                entries={log.map((e) => ({
                  ...e,
                  detail: [e.actor ? `by ${e.actor}` : null, e.detail].filter(Boolean).join(" — ") || undefined,
                }))}
              />
            )}
          </Card>

          <Card title="Settlement" className="col-span-4">
            <div className="flex flex-col gap-3 text-sm">
              {d.payments.length === 0 && d.creditNotes.length === 0 ? (
                <p className="text-ink-secondary">
                  Nothing received against the account since this bill was issued.
                </p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {d.payments.map((p) => (
                    <li key={p.id} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-ink-secondary">
                        {p.reference ?? p.method ?? "Payment"}
                        <span className="block text-xs text-ink-sub">{formatDate(p.received_at)}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-ink">
                        {formatMoneyFull(p.amount ?? 0, p.currency || currency)}
                      </span>
                    </li>
                  ))}
                  {d.creditNotes.map((c) => (
                    <li key={c.id} className="flex items-baseline justify-between gap-3">
                      <span className="min-w-0 truncate text-ink-secondary">
                        Credit {c.number}
                        <span className="block text-xs text-ink-sub">{formatDate(c.issued_at)}</span>
                      </span>
                      <span className="shrink-0 tabular-nums text-ink">
                        {formatMoneyFull(c.amount ?? 0, c.currency || currency)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              <p className="rounded-lg bg-well p-3 text-xs text-ink-secondary">
                Payments are recorded against the client, not against a single document. These are
                the receipts dated on or after this bill — they settle the account, which this bill
                is part of.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
