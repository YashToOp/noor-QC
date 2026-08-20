"use client";

import { AlertTriangle } from "lucide-react";
import { ItemPicture } from "./item-picture";
import type { InvoiceDoc } from "@/lib/invoice";
import { formatCount, formatDate, formatMoneyFull } from "@/lib/format";

/**
 * The invoice document — DESIGN_SYSTEM.md §7.6's print view: "a 210mm white
 * sheet with no canvas, no shadows, #172131 on white".
 *
 * One sheet per manufacturer. It carries what the customer asked for: their
 * name, the manufacturer's name, and per line the item, the colour, the
 * quantity, the rate and the picture.
 *
 * The `print:` variants are what make Download work without a PDF library —
 * the browser's own print-to-PDF renders this sheet and nothing else. See the
 * `@media print` block in app/components.css.
 */
export function InvoiceSheet({ doc }: { doc: InvoiceDoc }) {
  return (
    <article
      className="invoice-sheet mx-auto w-full max-w-[210mm] bg-white p-10 text-ink print:max-w-none print:p-0"
      aria-label={`Invoice ${doc.number} for ${doc.houseName}`}
    >
      {/* ── Masthead ─────────────────────────────────────────── */}
      <header className="flex items-start justify-between gap-8 border-b border-line-divider pb-6">
        <div className="min-w-0">
          <p className="text-xl font-medium leading-7 text-ink">{doc.sellerName}</p>
          <p className="mt-1 text-xs text-ink-secondary">
            Manufacturing order invoice
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-medium tabular-nums text-ink">{doc.number}</p>
          <p className="mt-1 text-xs tabular-nums text-ink-secondary">
            Order {doc.orderNumber}
          </p>
          {doc.issuedAt && (
            <p className="text-xs tabular-nums text-ink-secondary">
              Issued {formatDate(doc.issuedAt)}
            </p>
          )}
          {doc.dueAt && (
            <p className="text-xs tabular-nums text-ink-secondary">
              Due {formatDate(doc.dueAt)}
            </p>
          )}
        </div>
      </header>

      {/* ── Parties ──────────────────────────────────────────── */}
      <section className="grid grid-cols-2 gap-8 border-b border-line-divider py-6">
        <div>
          <p className="text-xs font-medium uppercase text-ink-sub">Customer</p>
          <p className="mt-1.5 text-sm font-medium text-ink">{doc.clientName}</p>
          <p className="text-xs text-ink-secondary">{doc.clientCode}</p>
          {doc.clientAddress && (
            <p className="text-xs text-ink-secondary">{doc.clientAddress}</p>
          )}
        </div>
        <div>
          <p className="text-xs font-medium uppercase text-ink-sub">Manufacturer</p>
          <p className="mt-1.5 text-sm font-medium text-ink">{doc.houseName}</p>
          <p className="text-xs text-ink-secondary">{doc.houseCode}</p>
          {doc.houseAddress && <p className="text-xs text-ink-secondary">{doc.houseAddress}</p>}
        </div>
      </section>

      {/* ── Lines ────────────────────────────────────────────── */}
      <table className="w-full border-collapse py-6 text-left">
        <caption className="sr-only">
          Items on invoice {doc.number} for {doc.houseName}
        </caption>
        <thead>
          <tr className="border-b border-line-divider">
            <th scope="col" className="py-2 pr-3 text-xs font-medium text-ink-secondary">
              Item
            </th>
            <th scope="col" className="px-3 py-2 text-xs font-medium text-ink-secondary">
              Colour
            </th>
            <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-ink-secondary">
              Qty
            </th>
            <th scope="col" className="px-3 py-2 text-right text-xs font-medium text-ink-secondary">
              Rate
            </th>
            <th scope="col" className="py-2 pl-3 text-right text-xs font-medium text-ink-secondary">
              Amount
            </th>
          </tr>
        </thead>
        <tbody>
          {doc.lines.map((line) => (
            <tr key={line.id} className="border-b border-line-divider align-middle">
              <td className="py-3 pr-3">
                <div className="flex items-center gap-3">
                  <ItemPicture
                    picture={line.picture}
                    alt={`${line.itemName}, ${line.colourName}`}
                    size={56}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">{line.itemName}</p>
                    <p className="text-xs text-ink-secondary">
                      {line.styleCode}
                      {line.fabric ? ` · ${line.fabric}` : ""}
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-3 py-3">
                <span className="flex items-center gap-2">
                  {line.colourHex && (
                    <span
                      className="size-3.5 shrink-0 rounded-full border-hairline border-line"
                      style={{
                        background: line.colourHex,
                        WebkitPrintColorAdjust: "exact",
                        printColorAdjust: "exact",
                      }}
                      aria-hidden
                    />
                  )}
                  <span className="text-sm text-ink-secondary">{line.colourName}</span>
                </span>
              </td>
              <td className="px-3 py-3 text-right text-sm tabular-nums text-ink">
                {formatCount(line.pcs)}
                {line.packs != null && (
                  <span className="block text-xs text-ink-secondary">
                    {formatCount(line.packs)} packs
                  </span>
                )}
              </td>
              <td className="px-3 py-3 text-right text-sm tabular-nums text-ink-secondary">
                {formatMoneyFull(line.rate, doc.currency)}
              </td>
              <td className="py-3 pl-3 text-right text-sm font-medium tabular-nums text-ink">
                {formatMoneyFull(line.amount, doc.currency)}
                {line.storedAmount !== null && (
                  <span className="block text-xs font-normal text-[#8c1a20]">
                    row says {formatMoneyFull(line.storedAmount, doc.currency)}
                  </span>
                )}
              </td>
            </tr>
          ))}
          {doc.lines.length === 0 && (
            <tr>
              <td colSpan={5} className="py-6 text-center text-sm text-ink-secondary">
                This order has no lines.
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* ── Totals ───────────────────────────────────────────── */}
      <section className="flex justify-end pt-4">
        <dl className="w-[280px] text-sm">
          <Line label="Subtotal" value={formatMoneyFull(doc.subtotal, doc.currency)} />
          <Line label="Freight" value={formatMoneyFull(doc.freight, doc.currency)} />
          <Line label="Packing" value={formatMoneyFull(doc.packing, doc.currency)} />
          <div className="mt-2 flex items-baseline justify-between border-t border-line-divider pt-2">
            <dt className="font-medium text-ink">Total</dt>
            <dd className="text-base font-medium tabular-nums text-ink">
              {formatMoneyFull(doc.total, doc.currency)}
            </dd>
          </div>
          <div className="mt-1 flex items-baseline justify-between">
            <dt className="text-xs text-ink-secondary">Pieces</dt>
            <dd className="text-xs tabular-nums text-ink-secondary">
              {formatCount(doc.totalPcs)}
            </dd>
          </div>
        </dl>
      </section>

      {/*
        An invoice that does not equal its own lines is worse than no invoice,
        so the discrepancy is printed on the document rather than hidden.
      */}
      {doc.discrepancy && (
        <section className="mt-6 flex items-start gap-2 rounded-lg border-hairline border-line bg-well p-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-state-warning" aria-hidden />
          <p className="text-xs text-ink-secondary">
            <span className="font-medium text-ink">Totals do not match the order record. </span>
            These lines come to {formatMoneyFull(doc.discrepancy.computedSubtotal, doc.currency)},
            while the order stores{" "}
            {doc.discrepancy.storedSubtotal === null
              ? "no subtotal at all"
              : formatMoneyFull(doc.discrepancy.storedSubtotal, doc.currency)}
            . The figures above are computed from quantity × rate, which is what the lines
            actually say.
          </p>
        </section>
      )}

      <footer className="mt-8 border-t border-line-divider pt-4">
        <p className="text-xs text-ink-secondary">
          Raised by {doc.sellerName} against order {doc.orderNumber}. All amounts in{" "}
          {doc.currency}.
        </p>
      </footer>
    </article>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-0.5">
      <dt className="text-ink-secondary">{label}</dt>
      <dd className="tabular-nums text-ink">{value}</dd>
    </div>
  );
}
