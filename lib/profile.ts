import type {
  AuditEvent,
  CreditNote,
  Enquiry,
  Invoice,
  Issue,
  ManufacturerOrder,
  Payment,
  ProductionEvent,
  ProductionStage,
} from "./types";

/**
 * PARTNER HISTORY
 *
 * The derivations behind the client and house profiles. Two things about this
 * schema shape everything below, and both are worth knowing before reading a
 * number off one of these pages.
 *
 * **There is no house-side finance.** `invoices`, `payments`, `credit_notes`
 * and `ledger_entries` are keyed by `client_id` only — nothing in the schema
 * records what Noor owes a house. So a house profile reports *order value
 * booked*, which is real, and does not pretend to show payables, which is not.
 *
 * **The audit log is empty.** `events(entity_type, entity_id, action, ...)`
 * exists and nothing writes to it. Rather than render a blank panel and call
 * it "logs", the activity rail is reconstructed from the timestamps the system
 * actually keeps — orders, gate decisions, stage completions, issues,
 * invoices, payments — and any real `events` rows are merged in on top. Every
 * line on that rail is a fact with a time behind it.
 */

/* ────────────────────────────────────────────────────────────────────────
   Money
   ──────────────────────────────────────────────────────────────────────── */

export interface Balance {
  invoiced: number;
  paid: number;
  credited: number;
  /** What the client still owes: invoiced − paid − credited. */
  outstanding: number;
  /** Invoiced, past `due_at`, and not covered by payments. */
  overdue: number;
  currency: string;
}

export function clientBalance(
  invoices: Invoice[],
  payments: Payment[],
  creditNotes: CreditNote[],
  now: number,
  fallbackCurrency: string,
): Balance {
  const invoiced = sum(invoices.map((i) => i.amount));
  const paid = sum(payments.map((p) => p.amount));
  const credited = sum(creditNotes.map((c) => c.amount));
  const outstanding = invoiced - paid - credited;

  // Overdue is capped by what is actually still outstanding: paying the newest
  // invoice first should not leave an old one looking unpaid forever.
  const pastDue = sum(
    invoices
      .filter((i) => i.due_at && new Date(`${i.due_at}T23:59:59`).getTime() < now)
      .map((i) => i.amount),
  );
  const overdue = Math.max(0, Math.min(pastDue, outstanding));

  return {
    invoiced,
    paid,
    credited,
    outstanding,
    overdue,
    currency: invoices[0]?.currency ?? payments[0]?.currency ?? fallbackCurrency,
  };
}

/* ────────────────────────────────────────────────────────────────────────
   Delivery
   ──────────────────────────────────────────────────────────────────────── */

export interface DeliveryRecord {
  /** Orders whose ladder finished and that had a promised date. */
  measured: number;
  onTime: number;
  /** Share on or before the promised date, or null when nothing has finished. */
  onTimePct: number | null;
  /** Mean days between finishing and the promised date; negative is early. */
  avgDaysLate: number | null;
}

/**
 * How a party actually delivers, measured from the stage ladder rather than
 * from order status — status says where an order is, the ladder says when it
 * got there.
 */
export function deliveryRecord(
  orders: ManufacturerOrder[],
  events: ProductionEvent[],
  stages: ProductionStage[],
): DeliveryRecord {
  const finalSort = Math.max(...stages.map((s) => s.sort), 0);
  const finalStageIds = new Set(stages.filter((s) => s.sort === finalSort).map((s) => s.id));
  const orderById = new Map(orders.map((o) => [o.id, o]));

  let measured = 0;
  let onTime = 0;
  const lateness: number[] = [];

  for (const e of events) {
    if (!finalStageIds.has(e.stage_id) || !e.completed_at) continue;
    const order = orderById.get(e.manufacturer_order_id);
    if (!order?.promised_ship_date) continue;

    const done = new Date(e.completed_at).getTime();
    const promised = new Date(`${order.promised_ship_date}T23:59:59`).getTime();

    measured += 1;
    if (done <= promised) onTime += 1;
    lateness.push((done - promised) / 86_400_000);
  }

  return {
    measured,
    onTime,
    onTimePct: measured === 0 ? null : (onTime / measured) * 100,
    avgDaysLate: lateness.length
      ? lateness.reduce((a, b) => a + b, 0) / lateness.length
      : null,
  };
}

/* ────────────────────────────────────────────────────────────────────────
   Order book
   ──────────────────────────────────────────────────────────────────────── */

const LIVE_STATUSES = [
  "proforma_issued",
  "negotiating",
  "approved",
  "in_review",
  "review_query",
  "released",
  "in_production",
  "inspection",
  "packed",
  "shipped",
];

export interface OrderBook {
  total: number;
  lifetimeValue: number;
  liveCount: number;
  liveValue: number;
  closedCount: number;
  lostCount: number;
}

export function orderBook(orders: ManufacturerOrder[]): OrderBook {
  const live = orders.filter((o) => LIVE_STATUSES.includes(o.status));
  return {
    total: orders.length,
    // Lifetime value excludes orders that never became real work.
    lifetimeValue: sum(
      orders
        .filter((o) => !["declined", "cancelled", "quoting"].includes(o.status))
        .map((o) => o.total),
    ),
    liveCount: live.length,
    liveValue: sum(live.map((o) => o.total)),
    closedCount: orders.filter((o) => ["arrived", "closed"].includes(o.status)).length,
    lostCount: orders.filter((o) => ["declined", "cancelled"].includes(o.status)).length,
  };
}

/* ────────────────────────────────────────────────────────────────────────
   Activity
   ──────────────────────────────────────────────────────────────────────── */

export interface ActivityEntry {
  id: string;
  at: string;
  title: string;
  detail?: string;
  /** Which subsystem the line came from — rendered as a chip. */
  source:
    | "Order"
    | "Gate"
    | "Production"
    | "Issue"
    | "Finance"
    | "Enquiry"
    | "Sample"
    | "Log";
  href?: string;
}

export interface ActivityInput {
  orders: ManufacturerOrder[];
  events: ProductionEvent[];
  stages: ProductionStage[];
  issues: Issue[];
  enquiries?: Enquiry[];
  invoices?: Invoice[];
  payments?: Payment[];
  creditNotes?: CreditNote[];
  auditEvents?: AuditEvent[];
  orderNumberById: Map<string, string>;
}

/**
 * Build one dated rail out of everything that happened to a party.
 *
 * Newest first, because the question a profile answers is almost always "what
 * has been going on lately", not "how did this start".
 */
export function buildActivity(input: ActivityInput): ActivityEntry[] {
  const {
    orders,
    events,
    stages,
    issues,
    enquiries = [],
    invoices = [],
    payments = [],
    creditNotes = [],
    auditEvents = [],
    orderNumberById,
  } = input;

  const stageById = new Map(stages.map((s) => [s.id, s]));
  const out: ActivityEntry[] = [];
  const orderRef = (id: string | null | undefined) =>
    id ? orderNumberById.get(id) ?? "an order" : "an order";

  for (const o of orders) {
    out.push({
      id: `order-created-${o.id}`,
      at: o.created_at,
      title: `${o.number} raised`,
      source: "Order",
      href: `/orders/${o.id}`,
    });
  }

  for (const e of enquiries) {
    if (!e.submitted_at) continue;
    out.push({
      id: `enq-${e.id}`,
      at: e.submitted_at,
      title: `Enquiry ${e.number} submitted`,
      source: "Enquiry",
    });
  }

  for (const e of events) {
    if (!e.completed_at) continue;
    out.push({
      id: `stage-${e.id}`,
      at: e.completed_at,
      title: `${stageById.get(e.stage_id)?.name ?? "Stage"} completed`,
      detail: `${orderRef(e.manufacturer_order_id)}${
        e.qty_out != null ? ` · ${e.qty_out} pieces out` : ""
      }`,
      source: "Production",
      href: `/orders/${e.manufacturer_order_id}`,
    });
  }

  for (const i of issues) {
    if (i.raised_at) {
      out.push({
        id: `issue-${i.id}`,
        at: i.raised_at,
        title: "Issue raised",
        detail: i.description ?? undefined,
        source: "Issue",
      });
    }
    if (i.resolved_at) {
      out.push({
        id: `issue-done-${i.id}`,
        at: i.resolved_at,
        title: i.status === "rejected" ? "Issue rejected" : "Issue resolved",
        detail: i.resolution ?? undefined,
        source: "Issue",
      });
    }
  }

  for (const inv of invoices) {
    if (!inv.issued_at) continue;
    out.push({
      id: `inv-${inv.id}`,
      at: inv.issued_at,
      title: `Invoice ${inv.number} issued`,
      detail: orderRef(inv.manufacturer_order_id),
      source: "Finance",
    });
  }

  for (const p of payments) {
    if (!p.received_at) continue;
    out.push({
      id: `pay-${p.id}`,
      at: p.received_at,
      title: "Payment received",
      detail: [p.method, p.reference].filter(Boolean).join(" · ") || undefined,
      source: "Finance",
    });
  }

  for (const c of creditNotes) {
    if (!c.issued_at) continue;
    out.push({
      id: `cn-${c.id}`,
      at: c.issued_at,
      title: `Credit note ${c.number}`,
      detail: c.reason ?? undefined,
      source: "Finance",
    });
  }

  // Real audit rows, if anything ever writes them.
  for (const e of auditEvents) {
    if (!e.created_at) continue;
    out.push({
      id: `evt-${e.id}`,
      at: e.created_at,
      title: `${e.action ?? "Event"} · ${e.entity_type ?? "record"}`,
      source: "Log",
    });
  }

  return out
    .filter((e) => e.at)
    .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
}

function sum(values: (number | null | undefined)[]): number {
  return values.reduce<number>((acc, v) => acc + Number(v ?? 0), 0);
}
