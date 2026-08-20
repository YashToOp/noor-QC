"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Download, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { EmptyState, ErrorState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { InvoiceSheet } from "@/components/invoice/invoice-sheet";
import { useGateDetail, useMediaAssets, useTenant } from "@/lib/queries";
import { buildInvoiceDoc, invoiceStage, STAGE_EXPLAIN, STAGE_LABEL } from "@/lib/invoice";
import { FileText } from "lucide-react";
import type { Colourway, Style } from "@/lib/types";

/**
 * ONE INVOICE — the document for a single manufacturer order.
 *
 * Reuses `useGateDetail`, which already loads exactly what an invoice needs:
 * the order, the client, the house, and the lines with their styles and
 * colourways. Only the imagery is fetched on top.
 */
export default function OrderInvoicePage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();

  const detail = useGateDetail(params.id);
  const media = useMediaAssets();
  const tenant = useTenant();

  const doc = React.useMemo(() => {
    const d = detail.data;
    if (!d) return null;
    return buildInvoiceDoc({
      tenant: tenant.data ?? null,
      order: d.order,
      client: d.client,
      house: d.house,
      lines: d.lines,
      // The lines already carry their joined style and colourway; index them
      // by id so buildInvoiceDoc can look them up.
      styles: new Map(
        d.lines
          .filter((l) => l.style_id && l.style)
          .map((l) => [l.style_id as string, l.style as Style]),
      ),
      colourways: new Map(
        d.lines
          .filter((l) => l.colourway_id && l.colourway)
          .map((l) => [l.colourway_id as string, l.colourway as Colourway]),
      ),
      media: media.data ?? [],
    });
  }, [detail.data, media.data, tenant.data]);

  if (detail.isError) {
    return (
      <>
        <PageHeader title="Invoice" breadcrumb={[{ label: "Invoices", href: "/invoices" }]} />
        <Card title="Invoice">
          <ErrorState
            thing="this invoice"
            reason={(detail.error as Error)?.message}
            onRetry={() => detail.refetch()}
          />
        </Card>
      </>
    );
  }

  if (detail.isLoading || !doc) {
    return (
      <>
        <PageHeader title="Invoice" breadcrumb={[{ label: "Invoices", href: "/invoices" }]} />
        <div className="pt-3">
          <Card title=" " className="h-[420px]">
            <Skeleton className="h-full w-full" />
          </Card>
        </div>
      </>
    );
  }

  if (!detail.data) {
    return (
      <>
        <PageHeader title="Invoice" breadcrumb={[{ label: "Invoices", href: "/invoices" }]} />
        <Card title="Invoice">
          <EmptyState
            icon={<FileText />}
            title="No such order"
            description="This invoice is raised against a manufacturer order that does not exist."
            action={{ label: "Back to invoices", onClick: () => router.push("/invoices") }}
          />
        </Card>
      </>
    );
  }

  const stage = invoiceStage(doc.orderStatus);
  const tone =
    stage === "sent"
      ? ({ tone: "active", label: STAGE_LABEL.sent } as const)
      : stage === "awaiting_approval"
        ? ({ tone: "pending", label: STAGE_LABEL.awaiting_approval } as const)
        : stage === "rejected"
          ? ({ tone: "rejected", label: STAGE_LABEL.rejected } as const)
          : ({ tone: "draft", label: STAGE_LABEL.not_ready } as const);

  return (
    <>
      <PageHeader
        title={`${doc.number} · ${doc.houseName}`}
        breadcrumb={[{ label: "Invoices", href: "/invoices" }]}
        actions={
          <>
            <StatusBadge spec={tone} dot />
            <Button variant="secondary" icon={<Download />} onClick={() => window.print()}>
              Download
            </Button>
            {stage === "awaiting_approval" && (
              <Button
                variant="primary"
                icon={<ShieldCheck />}
                onClick={() => router.push(`/gates/${doc.orderId}:order_review`)}
              >
                Open the gate
              </Button>
            )}
          </>
        }
      />

      <div className="min-h-0 flex-1 overflow-y-auto pt-3">
        <div className="flex flex-col gap-4 pb-4">
          <Card title="Where this invoice stands">
            <p className="text-sm text-ink-secondary">{STAGE_EXPLAIN[stage]}</p>
          </Card>

          <div className="print-region overflow-hidden rounded-xl border-hairline border-line bg-white print:rounded-none print:border-0">
            <InvoiceSheet doc={doc} />
          </div>
        </div>
      </div>
    </>
  );
}
