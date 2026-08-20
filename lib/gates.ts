import { supabase } from "./supabase";
import type {
  ChecklistState,
  ManufacturerOrder,
  OrderReview,
  ProductionStage,
} from "./types";
import type { GateStatus } from "./status";

/**
 * THE GATE MODEL
 *
 * docs/13-integration-contract.md describes a `gates` table with a `gate_type`
 * column. That table does not exist in the shared project. The deployed schema
 * has `order_reviews` instead — same substance (`checks` jsonb, `note`,
 * `decided_at`, a reviewer), but no `gate_type`, and its `review_outcome` enum
 * is `passed | query | rejected` with no `pending` member.
 *
 * Two consequences, both deliberate:
 *
 *   1. Every gate this queue can express is an **Order review**. The other
 *      three gate types in the contract (sample release, stage verify,
 *      dispatch) have nowhere to live without a schema change, which Rule Zero
 *      forbids. The gate-type column and filter still render — they are simply
 *      single-valued today, and adding a `gate_type` column later populates
 *      them without touching this code's shape.
 *
 *   2. `pending` is not a stored value. A gate is pending when its review has
 *      no `decided_at`, or when the order has reached `approved` and the
 *      review row has not been opened yet. `gateStatus()` below is the single
 *      place that decision is made.
 *
 * Who opens the gate: neither Flutter app writes `order_reviews`, and the
 * write map gives QC "creates + decides". So this dashboard opens the review
 * itself the moment it sees an order reach `approved`, and moves the order to
 * `in_review`. That is the contract's "gate opens automatically on approve".
 */

export const GATE_TYPE_ORDER_REVIEW = "order_review" as const;

export type GateType = "order_review" | "sample_release" | "stage_verify" | "dispatch";

export const GATE_TYPE_LABEL: Record<GateType, string> = {
  order_review: "Order review",
  sample_release: "Sample release",
  stage_verify: "Stage verify",
  dispatch: "Dispatch",
};

/**
 * The six checks of an order-review gate, in the order the customer reads them.
 * Keys are stable — they are what lands in `order_reviews.checks`.
 */
export const ORDER_REVIEW_CHECKS: { key: string; label: string }[] = [
  { key: "specs_complete", label: "Specifications complete and unambiguous" },
  { key: "ratios_feasible", label: "Size ratios feasible at this house" },
  { key: "moq_met", label: "Minimum order quantity met" },
  { key: "price_confirmed", label: "Price confirmed with the house" },
  { key: "lead_time_ok", label: "Lead time meets the client's date" },
  { key: "limit_available", label: "Working limit available" },
];

/** Statuses whose gate is still sitting in the queue awaiting a decision. */
export const AWAITING_STATUSES = ["approved", "in_review"] as const;

/** Derive the gate's status from the order and its review row. */
export function gateStatus(
  order: Pick<ManufacturerOrder, "status">,
  review: OrderReview | null | undefined,
): GateStatus {
  if (!review || !review.decided_at) {
    // No decision recorded. If the order has moved past review, trust the order.
    if (order.status === "review_query") return "query";
    if (order.status === "declined") return "rejected";
    return "pending";
  }
  switch (review.outcome) {
    case "passed":
      return "approved";
    case "query":
      return "query";
    case "rejected":
      return "rejected";
    default:
      return "pending";
  }
}

/** When the clock started running on this gate — what the "Waiting" column measures. */
export function waitingSince(
  order: Pick<ManufacturerOrder, "updated_at" | "created_at">,
  review: OrderReview | null | undefined,
): string {
  return review?.started_at ?? order.updated_at ?? order.created_at;
}

export function emptyChecks(): ChecklistState {
  return Object.fromEntries(ORDER_REVIEW_CHECKS.map((c) => [c.key, false]));
}

export function allChecked(checks: ChecklistState | null | undefined): boolean {
  if (!checks) return false;
  return ORDER_REVIEW_CHECKS.every((c) => checks[c.key] === true);
}

/**
 * Open the gate for an order that has just been approved by the client.
 *
 * Idempotent: if a review row already exists it is returned untouched, so two
 * browser tabs racing on the same realtime event cannot create two gates.
 */
export async function openGate(order: ManufacturerOrder): Promise<OrderReview> {
  const db = supabase();

  const { data: existing, error: readErr } = await db
    .from("order_reviews")
    .select("*")
    .eq("manufacturer_order_id", order.id)
    .maybeSingle();
  if (readErr) throw readErr;
  if (existing) return existing as OrderReview;

  const { data, error } = await db
    .from("order_reviews")
    .insert({
      tenant_id: order.tenant_id,
      manufacturer_order_id: order.id,
      checks: emptyChecks(),
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw error;

  // The order enters review. Nobody skips a state: approved → in_review → released.
  if (order.status === "approved") {
    const { error: statusErr } = await db
      .from("manufacturer_orders")
      .update({ status: "in_review", updated_at: new Date().toISOString() })
      .eq("id", order.id)
      .eq("status", "approved");
    if (statusErr) throw statusErr;
  }

  return data as OrderReview;
}

/** Persist a single checklist toggle back to `order_reviews.checks`. */
export async function saveChecks(reviewId: string, checks: ChecklistState): Promise<void> {
  const { error } = await supabase()
    .from("order_reviews")
    .update({ checks })
    .eq("id", reviewId);
  if (error) throw error;
}

/**
 * APPROVE — the write Sharik is waiting for.
 *
 * Three effects: the review passes, the order becomes `released`, and the
 * production stage rows are created.
 *
 * PostgREST gives no cross-table transaction, and wrapping this in an RPC
 * would mean creating a function in the shared project — a schema write Rule
 * Zero forbids. So the writes are ordered so that a failure part-way through
 * is safe rather than atomic:
 *
 *   1. stage rows first — invisible to everyone while the order is unreleased
 *   2. the release — the moment Sharik can see the order
 *   3. the decision stamp — audit, after the operational effect has landed
 *
 * The guarded `.eq("status", "in_review")` on step 2 means a double-click or a
 * second tab cannot release the same order twice.
 */
export async function approveGate(args: {
  review: OrderReview;
  order: ManufacturerOrder;
  stages: ProductionStage[];
  totalPcs: number;
  checks: ChecklistState;
  note?: string;
}): Promise<void> {
  const { review, order, stages, totalPcs, checks, note } = args;
  const db = supabase();

  await createStageRows(order, stages, totalPcs);

  const { data: released, error: relErr } = await db
    .from("manufacturer_orders")
    .update({ status: "released", updated_at: new Date().toISOString() })
    .eq("id", order.id)
    .in("status", ["in_review", "approved"])
    .select("id");
  if (relErr) throw relErr;
  if (!released?.length) {
    throw new Error(
      "This order is no longer awaiting review — it was decided in another window.",
    );
  }

  const { error: revErr } = await db
    .from("order_reviews")
    .update({
      checks,
      outcome: "passed",
      note: note ?? null,
      decided_at: new Date().toISOString(),
    })
    .eq("id", review.id);
  if (revErr) throw revErr;
}

/** Send the gate back to the client with a question. Order → `review_query`. */
export async function queryGate(args: {
  review: OrderReview;
  order: ManufacturerOrder;
  checks: ChecklistState;
  note: string;
}): Promise<void> {
  const db = supabase();
  const { error: statusErr } = await db
    .from("manufacturer_orders")
    .update({ status: "review_query", updated_at: new Date().toISOString() })
    .eq("id", args.order.id)
    .in("status", ["in_review", "approved"]);
  if (statusErr) throw statusErr;

  const { error } = await db
    .from("order_reviews")
    .update({
      checks: args.checks,
      outcome: "query",
      note: args.note,
      decided_at: new Date().toISOString(),
    })
    .eq("id", args.review.id);
  if (error) throw error;
}

/** Reject the gate. Terminal, and the reason is required. */
export async function rejectGate(args: {
  review: OrderReview;
  order: ManufacturerOrder;
  checks: ChecklistState;
  note: string;
}): Promise<void> {
  const db = supabase();
  const { error: statusErr } = await db
    .from("manufacturer_orders")
    .update({
      status: "declined",
      declined_reason: args.note,
      updated_at: new Date().toISOString(),
    })
    .eq("id", args.order.id)
    .in("status", ["in_review", "approved"]);
  if (statusErr) throw statusErr;

  const { error } = await db
    .from("order_reviews")
    .update({
      checks: args.checks,
      outcome: "rejected",
      note: args.note,
      decided_at: new Date().toISOString(),
    })
    .eq("id", args.review.id);
  if (error) throw error;
}

/**
 * Create one `production_events` row per stage, all `pending`.
 *
 * Sharik never inserts here — it only updates. `expected_at` is laid out from
 * today using each stage's `typical_duration_days`, cumulatively, so the
 * "stage past expected_at" risk calculation has something real to bite on.
 * `qty_in` is seeded on the first stage only; thereafter it is the previous
 * stage's `qty_out`, which is the chain Noor uses to see where pieces vanish.
 */
async function createStageRows(
  order: ManufacturerOrder,
  stages: ProductionStage[],
  totalPcs: number,
): Promise<void> {
  const db = supabase();

  const { data: existing, error: readErr } = await db
    .from("production_events")
    .select("id")
    .eq("manufacturer_order_id", order.id)
    .limit(1);
  if (readErr) throw readErr;
  if (existing?.length) return; // already released once — never duplicate the ladder

  const ordered = [...stages].sort((a, b) => a.sort - b.sort);
  let cursor = new Date();

  const rows = ordered.map((stage, i) => {
    cursor = addDays(cursor, stage.typical_duration_days ?? 3);
    return {
      tenant_id: order.tenant_id,
      manufacturer_order_id: order.id,
      stage_id: stage.id,
      status: "pending" as const,
      qty_in: i === 0 ? totalPcs : null,
      expected_at: cursor.toISOString().slice(0, 10),
    };
  });

  const { error } = await db.from("production_events").insert(rows);
  if (error) throw error;
}

function addDays(d: Date, days: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + days);
  return next;
}
