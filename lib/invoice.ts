import type {
  Client,
  Colourway,
  House,
  Invoice,
  ManufacturerOrder,
  MediaAsset,
  OrderLine,
  Style,
  Tenant,
} from "./types";

/**
 * THE INVOICE DOCUMENT
 *
 * One order is one client and one house, so a basket spanning four
 * manufacturers is already four `manufacturer_orders` — and therefore four
 * invoices. Nothing needs inventing to get "4 invoices for 4 manufacturers";
 * it falls out of the existing shape.
 *
 * **An invoice must foot.** Every amount here is computed from the lines —
 * `pcs × unit_price` — because that is what a line amount *is*. Where the
 * stored `line_total` or `manufacturer_orders.subtotal` disagrees, the document
 * shows the computed figure and reports the discrepancy rather than silently
 * choosing one. A total that does not equal its own lines is worse than no
 * invoice at all.
 */

export interface InvoiceLine {
  id: string;
  /** The picture. See `pictureFor` — this is the field the customer cares about. */
  picture: Picture;
  itemName: string;
  styleCode: string;
  fabric: string | null;
  colourName: string;
  colourHex: string | null;
  packs: number | null;
  pcs: number;
  rate: number;
  /** pcs × rate, always. */
  amount: number;
  /** What the row claims, when it disagrees with `amount`. */
  storedAmount: number | null;
}

export interface InvoiceDoc {
  /** Null until the invoice row exists — the document can be previewed first. */
  invoiceId: string | null;
  number: string;
  issuedAt: string | null;
  dueAt: string | null;

  sellerName: string;
  clientName: string;
  clientCode: string;
  clientAddress: string;

  /** The manufacturer this invoice is for. */
  houseName: string;
  houseCode: string;
  houseAddress: string;

  orderId: string;
  orderNumber: string;
  orderStatus: ManufacturerOrder["status"];
  currency: string;

  lines: InvoiceLine[];
  subtotal: number;
  freight: number;
  packing: number;
  total: number;
  totalPcs: number;

  /**
   * Set when the stored order totals disagree with the lines. Carries both
   * figures so the page can name the difference instead of hiding it.
   */
  discrepancy: { storedSubtotal: number | null; computedSubtotal: number } | null;
}

/* ────────────────────────────────────────────────────────────────────────
   The picture
   ──────────────────────────────────────────────────────────────────────── */

export type Picture =
  | { kind: "image"; url: string }
  | { kind: "gradient"; hexes: string[] }
  | { kind: "solid"; hex: string }
  | { kind: "none" };

/**
 * What to draw for an item.
 *
 * The demo database holds no photographs: every `media_assets.url` is the
 * literal `noor://gradient`, which is this platform's convention for "render
 * the gradient in `meta.gradient` instead of loading a file" — Majlis does
 * exactly that in its `GradientBlock`. Matching it here means the picture on
 * the invoice is the picture the client saw when they ordered.
 *
 * The order of preference is the same as Majlis's: a real image if there is
 * one, then the style's gradient, then the colourway's own hex, then nothing.
 * Swap a real URL into `media_assets.url` and this renders the photograph with
 * no code change.
 */
export function pictureFor(
  media: MediaAsset[],
  styleId: string | null,
  colourway: Colourway | null,
): Picture {
  const forStyle = media
    .filter((m) => m.owner_type === "style" && m.owner_id === styleId)
    .sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0));

  const real = forStyle.find((m) => m.url && /^https?:\/\//i.test(m.url));
  if (real?.url) return { kind: "image", url: real.url };

  for (const m of forStyle) {
    const hexes = gradientHexes(m);
    if (hexes.length) return { kind: "gradient", hexes };
  }

  if (colourway?.hex) return { kind: "solid", hex: colourway.hex };
  return { kind: "none" };
}

function gradientHexes(m: MediaAsset): string[] {
  const meta = m.meta as { gradient?: unknown } | null;
  const raw = meta?.gradient;
  if (!Array.isArray(raw)) return [];
  return raw.filter((h): h is string => typeof h === "string" && /^#[0-9a-f]{3,8}$/i.test(h));
}

/* ────────────────────────────────────────────────────────────────────────
   Building the document
   ──────────────────────────────────────────────────────────────────────── */

export interface BuildArgs {
  tenant: Tenant | null;
  order: ManufacturerOrder;
  client: Client | null;
  house: House | null;
  lines: OrderLine[];
  styles: Map<string, Style>;
  colourways: Map<string, Colourway>;
  media: MediaAsset[];
  invoice?: Invoice | null;
}

/** Money to 2dp. Float sums drift — 413478.98000000004 is not a price. */
function money(n: number): number {
  return Math.round(n * 100) / 100;
}

export function buildInvoiceDoc(args: BuildArgs): InvoiceDoc {
  const { tenant, order, client, house, lines, styles, colourways, media, invoice } = args;

  const docLines: InvoiceLine[] = lines.map((l) => {
    const style = l.style_id ? styles.get(l.style_id) ?? null : null;
    const colour = l.colourway_id ? colourways.get(l.colourway_id) ?? null : null;
    const pcs = Number(l.pcs ?? 0);
    const rate = Number(l.unit_price ?? 0);
    const amount = money(pcs * rate);
    const stored = l.line_total == null ? null : Number(l.line_total);

    return {
      id: l.id,
      picture: pictureFor(media, l.style_id, colour),
      itemName: style?.name ?? "Item",
      styleCode: style?.code ?? "—",
      fabric: style?.fabric ?? null,
      colourName: colour?.name ?? "—",
      colourHex: colour?.hex ?? null,
      packs: l.packs,
      pcs,
      rate,
      amount,
      storedAmount: stored !== null && Math.abs(stored - amount) > 0.01 ? stored : null,
    };
  });

  const subtotal = money(docLines.reduce((sum, l) => sum + l.amount, 0));
  const freight = money(Number(order.freight ?? 0));
  const packing = money(Number(order.packing ?? 0));
  const storedSubtotal = order.subtotal == null ? null : Number(order.subtotal);

  const disagrees =
    storedSubtotal === null || Math.abs(storedSubtotal - subtotal) > 0.01;

  return {
    invoiceId: invoice?.id ?? null,
    number: invoice?.number ?? `${order.number}`,
    issuedAt: invoice?.issued_at ?? null,
    dueAt: invoice?.due_at ?? null,

    sellerName: tenant?.name ?? "Noor",
    clientName: client?.name ?? "—",
    clientCode: client?.code ?? "—",
    clientAddress: [client?.city, client?.country].filter(Boolean).join(", "),

    houseName: house?.name ?? "—",
    houseCode: house?.code ?? "—",
    houseAddress: [house?.city, house?.country].filter(Boolean).join(", "),

    orderId: order.id,
    orderNumber: order.number,
    orderStatus: order.status,
    currency: order.currency,

    lines: docLines,
    subtotal,
    freight,
    packing,
    total: money(subtotal + freight + packing),
    totalPcs: docLines.reduce((sum, l) => sum + l.pcs, 0),

    discrepancy: disagrees ? { storedSubtotal, computedSubtotal: subtotal } : null,
  };
}

/* ────────────────────────────────────────────────────────────────────────
   Where an invoice is in the flow
   ──────────────────────────────────────────────────────────────────────── */

export type InvoiceStage =
  | "not_ready"
  | "awaiting_approval"
  | "sent"
  | "rejected";

/**
 * The invoice's own state, read off the order rather than stored.
 *
 * `invoices` has no status column, and it does not need one: the flow the
 * customer describes — issued to them, approved by us, sent to the
 * manufacturer — is exactly the order's own journey through the review gate.
 * Deriving it means the invoice can never disagree with the order it bills.
 */
export function invoiceStage(status: ManufacturerOrder["status"]): InvoiceStage {
  switch (status) {
    case "quoting":
    case "negotiating":
      return "not_ready";
    case "proforma_issued":
    case "approved":
    case "in_review":
    case "review_query":
      return "awaiting_approval";
    case "declined":
    case "cancelled":
      return "rejected";
    default:
      // released and everything after it — the house can see the order.
      return "sent";
  }
}

export const STAGE_LABEL: Record<InvoiceStage, string> = {
  not_ready: "Not ready",
  awaiting_approval: "Awaiting your approval",
  sent: "Sent to the manufacturer",
  rejected: "Rejected",
};

export const STAGE_EXPLAIN: Record<InvoiceStage, string> = {
  not_ready: "Still being quoted or negotiated with the client.",
  awaiting_approval: "Approving releases the order, which is what puts it in front of the house.",
  sent: "The house can see this order and is working it.",
  rejected: "This order will not proceed.",
};
