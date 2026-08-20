import { GATE_TYPE_LABEL, type GateType } from "./gates";
import { STATUS_LABEL } from "./status";
import { UNKNOWN } from "./format";
import type { ActivityEntry } from "./profile";
import type {
  Approval,
  AppUser,
  Client,
  CreditNote,
  Enquiry,
  House,
  Invoice,
  Issue,
  IssueType,
  LedgerEntry,
  ManufacturerOrder,
  OrderLine,
  OrderReview,
  Payment,
  ProductionEvent,
  ProductionStage,
  Tenant,
} from "./types";

/**
 * THE BILL DOSSIER
 *
 * A bill number is the one identifier everybody outside this building has —
 * it is on the paper the client filed and on the paper the house was sent. So
 * typing it into the search box has to answer the whole question: who bought,
 * who sold, and everything that happened between the two.
 *
 * Nothing here is a new record. The log is assembled from the timestamps the
 * system already keeps — the enquiry, the order, its gates, its stages, its
 * approvals, its issues and its money — and every line says which subsystem it
 * came from, so a reconstructed line can never be mistaken for a stored audit
 * row. Where a fact does not exist (nobody signed a gate; the schema records
 * payments against the client, not the bill) it says so rather than guessing.
 */

/* ────────────────────────────────────────────────────────────────────────
   Matching a bill number
   ──────────────────────────────────────────────────────────────────────── */

/** Just the digits, so `INV-2026-0158` reduces to `20260158`. */
export function billDigits(value: string): string {
  return value.replace(/\D/g, "");
}

/**
 * Does this bill number answer the query?
 *
 * Operators quote a bill three ways: the whole number off the paper
 * (`INV-2026-0158`), the serial alone (`0158`, or `158` with the padding
 * dropped), or the order it bills (`NT-2026-0163-A`). All three land here.
 * A pure-digit query has to be at least three characters, because two digits
 * match most of the ledger and a search that returns everything is noise.
 */
export function billMatches(
  invoiceNumber: string,
  orderNumber: string | null,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return false;

  if (invoiceNumber.toLowerCase().includes(q)) return true;
  if (orderNumber && orderNumber.toLowerCase().includes(q)) return true;

  const qd = billDigits(q);
  if (qd.length >= 3 && billDigits(invoiceNumber).includes(qd)) return true;

  return false;
}

/* ────────────────────────────────────────────────────────────────────────
   The dossier
   ──────────────────────────────────────────────────────────────────────── */

export interface BillDossier {
  invoice: Invoice;
  order: ManufacturerOrder | null;
  enquiry: Enquiry | null;
  client: Client | null;
  house: House | null;
  tenant: Tenant | null;
  lines: OrderLine[];
  reviews: OrderReview[];
  events: ProductionEvent[];
  stages: ProductionStage[];
  approvals: Approval[];
  issues: Issue[];
  issueTypes: IssueType[];
  /** The client's payments from this bill's issue date on — see `settlement`. */
  payments: Payment[];
  creditNotes: CreditNote[];
  ledger: LedgerEntry[];
  people: Map<string, AppUser>;
}

/** The four facts the operator is actually looking for, named plainly. */
export interface BillFacts {
  placedAt: string | null;
  /** Who decided the order-review gate. Null when nobody signed it. */
  confirmedBy: string | null;
  confirmedAt: string | null;
  /** When the order became visible to the house — the same write as release. */
  forwardedAt: string | null;
  issuesOpen: number;
  issuesResolved: number;
}

const RELEASED_ONWARDS: ManufacturerOrder["status"][] = [
  "released",
  "in_production",
  "inspection",
  "packed",
  "shipped",
  "arrived",
  "closed",
];

export function billFacts(d: BillDossier): BillFacts {
  const orderGate = d.reviews.find(
    (r) => r.gate_type === "order_review" && r.outcome === "passed" && r.decided_at,
  );

  const forwarded =
    orderGate?.decided_at ??
    // No gate row survived, but the order is past release — the order's own
    // updated_at is the closest honest stamp, and only for orders that got there.
    (d.order && RELEASED_ONWARDS.includes(d.order.status) ? d.order.updated_at : null);

  return {
    placedAt: d.order?.created_at ?? d.enquiry?.submitted_at ?? null,
    confirmedBy: orderGate?.reviewer_id
      ? d.people.get(orderGate.reviewer_id)?.display_name ?? null
      : null,
    confirmedAt: orderGate?.decided_at ?? null,
    forwardedAt: forwarded,
    issuesOpen: d.issues.filter((i) => i.status !== "resolved" && i.status !== "rejected").length,
    issuesResolved: d.issues.filter((i) => i.status === "resolved").length,
  };
}

/* ────────────────────────────────────────────────────────────────────────
   The log
   ──────────────────────────────────────────────────────────────────────── */

/**
 * One line of the bill's history. `actor` is separate from `detail` because
 * "who did this" is the question the operator opened the bill to answer.
 */
export interface BillLogEntry extends ActivityEntry {
  actor: string | null;
}

function gateTitle(review: OrderReview, houseName: string): string {
  const label = GATE_TYPE_LABEL[review.gate_type as GateType] ?? "Gate";
  if (!review.decided_at) return `${label} opened — awaiting a decision`;
  switch (review.outcome) {
    case "passed":
      return review.gate_type === "order_review"
        ? `Forwarded to ${houseName} — order released`
        : review.gate_type === "dispatch"
          ? "Cleared for dispatch"
          : "Stage work verified";
    case "query":
      return `${label} queried back to the house`;
    case "rejected":
      return `${label} rejected`;
    default:
      return `${label} decided`;
  }
}

/**
 * Assemble the bill's history, **oldest first**.
 *
 * The profile rail runs newest-first because a partner's question is "what has
 * been going on lately". A bill's question is the opposite — it is a story with
 * a beginning, and the operator is reading it forward to find where it went
 * wrong.
 */
export function buildBillLog(d: BillDossier): BillLogEntry[] {
  const out: BillLogEntry[] = [];
  const houseName = d.house?.name ?? "the house";
  const stageById = new Map(d.stages.map((s) => [s.id, s]));
  const typeById = new Map(d.issueTypes.map((t) => [t.id, t]));
  const who = (id: string | null | undefined) =>
    id ? d.people.get(id)?.display_name ?? null : null;

  // A line with no timestamp cannot be placed on a timeline, so it is dropped
  // rather than dated to now — an invented date is worse than a missing line.
  const push = (e: Omit<BillLogEntry, "at"> & { at: string | null }) => {
    if (e.at) out.push({ ...e, at: e.at });
  };

  // ── The enquiry and the order ────────────────────────────────────────
  if (d.enquiry?.submitted_at) {
    push({
      id: `enq-${d.enquiry.id}`,
      at: d.enquiry.submitted_at,
      title: `Enquiry ${d.enquiry.number} submitted`,
      detail: d.client ? `Placed by ${d.client.name}` : undefined,
      actor: d.client?.name ?? null,
      source: "Enquiry",
    });
  }

  if (d.order) {
    push({
      id: `order-${d.order.id}`,
      at: d.order.created_at,
      title: `Order ${d.order.number} placed with ${houseName}`,
      detail: `Now ${STATUS_LABEL[d.order.status] ?? d.order.status}`,
      actor: null,
      source: "Order",
      href: `/orders/${d.order.id}`,
    });
  }

  // ── Gates: opened, then decided, with the reviewer named ─────────────
  for (const r of d.reviews) {
    const label = GATE_TYPE_LABEL[r.gate_type as GateType] ?? "Gate";
    if (r.started_at) {
      push({
        id: `gate-open-${r.id}`,
        at: r.started_at,
        title: `${label} opened`,
        detail: r.decided_at ? undefined : "Still waiting on a decision",
        actor: null,
        source: "Gate",
        href: d.order ? `/gates/${d.order.id}:${r.gate_type}` : undefined,
      });
    }
    if (r.decided_at) {
      const actor = who(r.reviewer_id);
      push({
        id: `gate-decided-${r.id}`,
        at: r.decided_at,
        title: gateTitle(r, houseName),
        detail: r.note ?? undefined,
        actor,
        source: "Gate",
        href: d.order ? `/gates/${d.order.id}:${r.gate_type}` : undefined,
      });
    }
  }

  // ── Samples and lab dips ─────────────────────────────────────────────
  for (const a of d.approvals) {
    if (!a.decided_at) continue;
    push({
      id: `appr-${a.id}`,
      at: a.decided_at,
      title: `${a.title ?? "Approval"} — ${a.status.replace(/_/g, " ")}`,
      detail: a.reason ?? undefined,
      actor: who((a as Approval & { decided_by?: string | null }).decided_by),
      source: "Sample",
    });
  }

  // ── The floor ────────────────────────────────────────────────────────
  for (const e of d.events) {
    const stage = stageById.get(e.stage_id);
    if (e.started_at) {
      push({
        id: `stage-start-${e.id}`,
        at: e.started_at,
        title: `${stage?.name ?? "Stage"} started`,
        detail: e.qty_in != null ? `${e.qty_in.toLocaleString()} pcs in` : undefined,
        actor: null,
        source: "Production",
      });
    }
    if (e.completed_at) {
      push({
        id: `stage-done-${e.id}`,
        at: e.completed_at,
        title: `${stage?.name ?? "Stage"} completed`,
        detail: [
          e.qty_out != null ? `${e.qty_out.toLocaleString()} pcs out` : null,
          e.note,
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
        actor: null,
        source: "Production",
      });
    }
  }

  // ── Issues, raised and settled ───────────────────────────────────────
  for (const i of d.issues) {
    push({
      id: `issue-raised-${i.id}`,
      at: i.raised_at,
      title: `Issue raised — ${typeById.get(i.issue_type_id ?? "")?.name ?? "issue"}`,
      detail: i.description ?? undefined,
      actor: who((i as Issue & { raised_by?: string | null }).raised_by),
      source: "Issue",
      href: `/issues?issue=${i.id}`,
    });
    if (i.resolved_at) {
      push({
        id: `issue-resolved-${i.id}`,
        at: i.resolved_at,
        title: `Issue resolved — ${(i.resolution ?? "settled").replace(/_/g, " ")}`,
        detail: [
          i.cost_impact != null ? `Cost impact ${i.cost_impact.toLocaleString()}` : null,
          i.days_impact ? `${i.days_impact} day${i.days_impact === 1 ? "" : "s"} lost` : null,
        ]
          .filter(Boolean)
          .join(" · ") || undefined,
        actor: who((i as Issue & { approver_id?: string | null }).approver_id),
        source: "Issue",
        href: `/issues?issue=${i.id}`,
      });
    }
  }

  // ── Money ────────────────────────────────────────────────────────────
  push({
    id: `inv-${d.invoice.id}`,
    at: d.invoice.issued_at,
    title: `Invoice ${d.invoice.number} issued`,
    detail: d.invoice.due_at ? `Due ${d.invoice.due_at}` : undefined,
    actor: null,
    source: "Finance",
  });

  for (const p of d.payments) {
    push({
      id: `pay-${p.id}`,
      at: p.received_at,
      title: "Payment received against the account",
      detail: p.reference ?? p.method ?? undefined,
      actor: null,
      source: "Finance",
    });
  }

  for (const c of d.creditNotes) {
    push({
      id: `cn-${c.id}`,
      at: c.issued_at,
      title: `Credit note ${c.number} issued`,
      detail: c.reason ?? undefined,
      actor: null,
      source: "Finance",
    });
  }

  return out.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
}

/** Subtitle for a bill in the search results — buyer and order in one line. */
export function billSubtitle(
  clientName: string | null,
  orderNumber: string | null,
  houseName: string | null,
): string {
  return [clientName ?? UNKNOWN, orderNumber, houseName].filter(Boolean).join(" · ");
}
