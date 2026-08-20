import { supabase } from "./supabase";
import type {
  Approval,
  ChecklistState,
  ManufacturerOrder,
  OrderReview,
  ProductionEvent,
  ProductionStage,
} from "./types";
import type { GateStatus } from "./status";

/**
 * THE GATE MODEL
 *
 * Gates live in `order_reviews`. The table is named for the first gate that
 * existed, but since the `gate_type` column was added it carries all four the
 * integration contract describes:
 *
 *   order_review    order hits `approved`        → approve releases it to the house
 *   sample_release  a sample awaits the client   → approve makes it visible to them
 *   stage_verify    the seller completed a stage → approve counts the stage verified
 *   dispatch        every stage is complete      → approve ships the order
 *
 * A gate has **no subject column** — neither does the contract's own `gates`
 * table. It is bound to an order, and the subject is derived: the stage in
 * flight, the sample awaiting release. That is only unambiguous while an order
 * holds at most one *open* gate of each type, which the partial unique index
 * `order_reviews_one_open_gate_per_type` enforces in the database.
 *
 * `pending` is still not a stored value: `review_outcome` is
 * `passed | query | rejected`, so a gate is pending exactly while `decided_at`
 * is null. `gateStatus()` is the single place that decision is made.
 */

export type GateType = "order_review" | "sample_release" | "stage_verify" | "dispatch";

export const GATE_TYPES: GateType[] = [
  "order_review",
  "sample_release",
  "stage_verify",
  "dispatch",
];

export const GATE_TYPE_LABEL: Record<GateType, string> = {
  order_review: "Order review",
  sample_release: "Sample release",
  stage_verify: "Stage verify",
  dispatch: "Dispatch",
};

/** What each gate is deciding, shown under the stepper on the detail page. */
export const GATE_TYPE_PURPOSE: Record<GateType, string> = {
  order_review: "Releasing this order to the house.",
  sample_release: "Putting this sample in front of the client.",
  stage_verify: "Accepting the stage the house has just finished.",
  dispatch: "Letting this order ship.",
};

/**
 * The checks each gate carries, in the order they are read. Keys are stable —
 * they are what lands in `order_reviews.checks`.
 */
export const CHECKS_BY_TYPE: Record<GateType, { key: string; label: string }[]> = {
  order_review: [
    { key: "specs_complete", label: "Specifications complete and unambiguous" },
    { key: "ratios_feasible", label: "Size ratios feasible at this house" },
    { key: "moq_met", label: "Minimum order quantity met" },
    { key: "price_confirmed", label: "Price confirmed with the house" },
    { key: "lead_time_ok", label: "Lead time meets the client's date" },
    { key: "limit_available", label: "Working limit available" },
  ],
  sample_release: [
    { key: "matches_standard", label: "Swatch matches the agreed standard" },
    { key: "lighting_recorded", label: "Lighting condition recorded" },
    { key: "colourway_identified", label: "Correct colourway and roll identified" },
    { key: "window_realistic", label: "Client's decision window is realistic" },
  ],
  stage_verify: [
    { key: "qty_reconciles", label: "Quantity out reconciles with quantity in" },
    { key: "evidence_present", label: "Evidence photographs present and legible" },
    { key: "defects_in_tolerance", label: "Defects within the agreed tolerance" },
    { key: "next_stage_ready", label: "Next stage can start on time" },
  ],
  dispatch: [
    { key: "stages_complete", label: "Every production stage complete" },
    { key: "inspection_passed", label: "Final inspection passed" },
    { key: "packing_matches", label: "Packing list matches the order" },
    { key: "paperwork_issued", label: "Client's paperwork issued" },
  ],
};

/**
 * Which decisions each gate offers, straight from the contract's gate table.
 * Only `order_review` can be rejected outright *and* queried; `dispatch` holds
 * rather than queries, which is the same write with an operator-facing word.
 */
export interface GateActions {
  /** Label for the `query` outcome, or null when the gate has no middle path. */
  secondary: string | null;
  /** Whether this gate can be rejected. */
  reject: boolean;
}

export const GATE_ACTIONS: Record<GateType, GateActions> = {
  order_review: { secondary: "Query", reject: true },
  sample_release: { secondary: null, reject: true },
  stage_verify: { secondary: "Query", reject: false },
  dispatch: { secondary: "Hold", reject: false },
};

export function gateTypeOf(review: OrderReview | null | undefined): GateType {
  return (review?.gate_type as GateType | undefined) ?? "order_review";
}

/** Derive the gate's status from the review row, falling back to the order. */
export function gateStatus(
  order: Pick<ManufacturerOrder, "status">,
  review: OrderReview | null | undefined,
): GateStatus {
  if (!review || !review.decided_at) {
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

/** When the clock started on this gate — what the "Waiting" column measures. */
export function waitingSince(
  order: Pick<ManufacturerOrder, "updated_at" | "created_at">,
  review: OrderReview | null | undefined,
): string {
  return review?.started_at ?? order.updated_at ?? order.created_at;
}

export function emptyChecks(type: GateType): ChecklistState {
  return Object.fromEntries(CHECKS_BY_TYPE[type].map((c) => [c.key, false]));
}

export function allChecked(type: GateType, checks: ChecklistState | null | undefined): boolean {
  if (!checks) return false;
  return CHECKS_BY_TYPE[type].every((c) => checks[c.key] === true);
}

/* ────────────────────────────────────────────────────────────────────────
   Opening gates
   ──────────────────────────────────────────────────────────────────────── */

export interface OpenableGate {
  order: ManufacturerOrder;
  gateType: GateType;
}

/**
 * Which gates ought to be open right now, given the state of the world.
 *
 * Three of the four have a trigger this schema can actually observe:
 *
 *   order_review   the order reached `approved`
 *   stage_verify   a stage flagged `requires_media` was completed after the
 *                  last stage_verify decision on that order
 *   dispatch       every stage is complete and the order has not shipped
 *
 * `sample_release` has none, and that is not an oversight: its trigger is "the
 * seller submits a sample", Sharik does not submit samples in V1, and
 * `approval_status` has no "awaiting QC release" member to represent one. So
 * sample gates are raised by hand from the queue toolbar until Sharik grows
 * that write — the gate itself is fully implemented either way.
 */
export function deriveOpenableGates(args: {
  orders: ManufacturerOrder[];
  reviews: OrderReview[];
  events: ProductionEvent[];
  stages: ProductionStage[];
}): OpenableGate[] {
  const { orders, reviews, events, stages } = args;
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const eventsByOrder = new Map<string, ProductionEvent[]>();
  for (const e of events) {
    const bucket = eventsByOrder.get(e.manufacturer_order_id);
    if (bucket) bucket.push(e);
    else eventsByOrder.set(e.manufacturer_order_id, [e]);
  }

  const openKeys = new Set(
    reviews.filter((r) => !r.decided_at).map((r) => `${r.manufacturer_order_id}:${r.gate_type}`),
  );
  const hasOpen = (orderId: string, type: GateType) => openKeys.has(`${orderId}:${type}`);

  const out: OpenableGate[] = [];

  for (const order of orders) {
    // ── order_review ─────────────────────────────────────────────────────
    if (order.status === "approved" && !hasOpen(order.id, "order_review")) {
      out.push({ order, gateType: "order_review" });
    }

    const ladder = eventsByOrder.get(order.id) ?? [];
    if (!ladder.length) continue;

    // ── stage_verify ─────────────────────────────────────────────────────
    // The last decision this order's stage gates reached; anything completed
    // after it is still waiting to be verified.
    const lastVerified = reviews
      .filter(
        (r) =>
          r.manufacturer_order_id === order.id &&
          r.gate_type === "stage_verify" &&
          r.decided_at,
      )
      .map((r) => new Date(r.decided_at!).getTime())
      .reduce((a, b) => Math.max(a, b), 0);

    const awaitingVerify = ladder.some((e) => {
      if (e.status !== "completed" || !e.completed_at) return false;
      if (!stageById.get(e.stage_id)?.requires_media) return false;
      return new Date(e.completed_at).getTime() > lastVerified;
    });

    if (awaitingVerify && !hasOpen(order.id, "stage_verify")) {
      out.push({ order, gateType: "stage_verify" });
    }

    // ── dispatch ─────────────────────────────────────────────────────────
    const allComplete = ladder.every((e) => e.status === "completed" || e.status === "skipped");
    const notYetShipped = !["shipped", "arrived", "closed", "cancelled"].includes(order.status);
    if (allComplete && notYetShipped && !hasOpen(order.id, "dispatch")) {
      out.push({ order, gateType: "dispatch" });
    }
  }

  return out;
}

/**
 * Open a gate.
 *
 * Idempotent twice over: it re-reads before inserting, and the partial unique
 * index refuses a second open gate of the same type on the same order, so two
 * tabs racing on one realtime event cannot produce two rows. A conflict there
 * is the expected outcome of a race, not an error, so it is swallowed and the
 * existing row returned.
 */
export async function openGate(
  order: ManufacturerOrder,
  gateType: GateType,
): Promise<OrderReview> {
  const db = supabase();

  const existing = await findOpenGate(order.id, gateType);
  if (existing) return existing;

  const { data, error } = await db
    .from("order_reviews")
    .insert({
      tenant_id: order.tenant_id,
      manufacturer_order_id: order.id,
      gate_type: gateType,
      checks: emptyChecks(gateType),
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();

  if (error) {
    // 23505 — the unique index caught a concurrent open. Use the winner's row.
    if ((error as { code?: string }).code === "23505") {
      const winner = await findOpenGate(order.id, gateType);
      if (winner) return winner;
    }
    throw error;
  }

  // An order review moves the order into review. Nobody skips a state:
  // approved → in_review → released.
  if (gateType === "order_review" && order.status === "approved") {
    const { error: statusErr } = await db
      .from("manufacturer_orders")
      .update({ status: "in_review", updated_at: new Date().toISOString() })
      .eq("id", order.id)
      .eq("status", "approved");
    if (statusErr) throw statusErr;
  }

  return data as OrderReview;
}

async function findOpenGate(orderId: string, gateType: GateType): Promise<OrderReview | null> {
  const { data, error } = await supabase()
    .from("order_reviews")
    .select("*")
    .eq("manufacturer_order_id", orderId)
    .eq("gate_type", gateType)
    .is("decided_at", null)
    .maybeSingle();
  if (error) throw error;
  return (data as OrderReview | null) ?? null;
}

/** Persist a checklist toggle back to `order_reviews.checks`. */
export async function saveChecks(reviewId: string, checks: ChecklistState): Promise<void> {
  const { error } = await supabase()
    .from("order_reviews")
    .update({ checks })
    .eq("id", reviewId);
  if (error) throw error;
}

/* ────────────────────────────────────────────────────────────────────────
   Deciding gates
   ──────────────────────────────────────────────────────────────────────── */

export type GateOutcome = "passed" | "query" | "rejected";

export interface DecideArgs {
  review: OrderReview;
  order: ManufacturerOrder;
  outcome: GateOutcome;
  checks: ChecklistState;
  note?: string;
  /** Needed to build the stage ladder when an order review passes. */
  stages?: ProductionStage[];
  totalPcs?: number;
  /** The order's ladder and samples, for the gates whose subject is derived. */
  events?: ProductionEvent[];
  approvals?: Approval[];
}

/**
 * Record a decision and apply its operational effect.
 *
 * PostgREST has no cross-table transaction and an RPC would mean creating a
 * function in the shared project, so the writes are ordered so a failure
 * part-way through is safe rather than atomic: the operational effect lands
 * first, guarded so it cannot fire twice, and the decision is stamped after.
 */
export async function decideGate(args: DecideArgs): Promise<void> {
  const { review, outcome, checks, note } = args;
  const gateType = gateTypeOf(review);

  if (outcome === "passed") await applyApproval(args, gateType);
  else await applyRefusal(args, gateType);

  const { error } = await supabase()
    .from("order_reviews")
    .update({
      checks,
      outcome,
      note: note ?? null,
      decided_at: new Date().toISOString(),
    })
    .eq("id", review.id);
  if (error) throw error;
}

async function applyApproval(args: DecideArgs, gateType: GateType): Promise<void> {
  const db = supabase();
  const { order } = args;

  switch (gateType) {
    case "order_review": {
      // The write Sharik is waiting for. Stage rows first — they are invisible
      // to everyone while the order is unreleased — then the release itself.
      await createStageRows(order, args.stages ?? [], args.totalPcs ?? 0);

      const { data, error } = await db
        .from("manufacturer_orders")
        .update({ status: "released", updated_at: new Date().toISOString() })
        .eq("id", order.id)
        .in("status", ["in_review", "approved"])
        .select("id");
      if (error) throw error;
      if (!data?.length) {
        throw new Error(
          "This order is no longer awaiting review — it was decided in another window.",
        );
      }
      return;
    }

    case "sample_release": {
      // "Approve → the approval becomes visible to the client." Majlis
      // subscribes to `approvals` filtered on status = 'pending', so moving
      // the sample there is exactly what puts the card on the client's phone.
      const sample = subjectApproval(args.approvals ?? []);
      if (!sample) {
        throw new Error("There is no sample on this order to release.");
      }
      const { error } = await db
        .from("approvals")
        .update({ status: "pending" })
        .eq("id", sample.id);
      if (error) throw error;
      return;
    }

    case "stage_verify":
      // "Approve → the stage counts as verified." There is no `verified`
      // column on production_events, and the contract's gate table has no
      // subject column to hang one off, so the decided gate row *is* the
      // verification record — which is why deriveOpenableGates compares a
      // stage's completed_at against the last stage_verify decision.
      return;

    case "dispatch": {
      const { data, error } = await db
        .from("manufacturer_orders")
        .update({ status: "shipped", updated_at: new Date().toISOString() })
        .eq("id", order.id)
        .not("status", "in", '("shipped","arrived","closed","cancelled")')
        .select("id");
      if (error) throw error;
      if (!data?.length) {
        throw new Error("This order has already shipped.");
      }
      return;
    }
  }
}

async function applyRefusal(args: DecideArgs, gateType: GateType): Promise<void> {
  const db = supabase();
  const { order, outcome, note } = args;

  switch (gateType) {
    case "order_review": {
      const status = outcome === "rejected" ? "declined" : "review_query";
      const patch: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      };
      if (outcome === "rejected") patch.declined_reason = note ?? null;

      const { error } = await db
        .from("manufacturer_orders")
        .update(patch)
        .eq("id", order.id)
        .in("status", ["in_review", "approved"]);
      if (error) throw error;
      return;
    }

    case "sample_release": {
      // Rejecting a sample sends it back for a re-dye rather than to the client.
      const sample = subjectApproval(args.approvals ?? []);
      if (!sample) return;
      const { error } = await db
        .from("approvals")
        .update({ status: "revision_requested", reason: note ?? null })
        .eq("id", sample.id);
      if (error) throw error;
      return;
    }

    case "stage_verify": {
      // Querying a stage sends the house back to redo it, which is what makes
      // the gate mean something: the stage stops counting as done.
      const stage = subjectEvent(args.events ?? []);
      if (!stage) return;
      const { error } = await db
        .from("production_events")
        .update({ status: "in_progress", completed_at: null })
        .eq("id", stage.id)
        .eq("status", "completed");
      if (error) throw error;
      return;
    }

    case "dispatch":
      // A hold changes nothing: the order simply does not ship. The gate row
      // carries the reason, and a fresh dispatch gate opens once it is decided.
      return;
  }
}

/**
 * The sample this gate is about: the most recent one that is not already
 * settled with the client.
 */
export function subjectApproval(approvals: Approval[]): Approval | null {
  const open = approvals.filter(
    (a) => a.status !== "approved" && a.status !== "superseded" && a.status !== "expired",
  );
  const pool = open.length ? open : approvals;
  return (
    [...pool].sort(
      (a, b) => new Date(b.due_at ?? 0).getTime() - new Date(a.due_at ?? 0).getTime(),
    )[0] ?? null
  );
}

/**
 * The stage this gate is about: the furthest-along completed one. Sharik only
 * ever works the lowest incomplete stage, so this is unambiguous.
 */
export function subjectEvent(events: ProductionEvent[]): ProductionEvent | null {
  const completed = events.filter((e) => e.status === "completed" && e.completed_at);
  if (!completed.length) return null;
  return [...completed].sort(
    (a, b) => new Date(b.completed_at!).getTime() - new Date(a.completed_at!).getTime(),
  )[0];
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
