/**
 * Row shapes for the tables Noor Core touches.
 *
 * Transcribed from the live schema of the shared `noor-demo` project — not
 * from docs/13-integration-contract.md, which is out of date in three places
 * (there is no `gates` table, `production_events` has no `photo_colours`, and
 * foreign keys are `manufacturer_order_id`, not `order_id`). Where the two
 * disagree, the database wins.
 */

/** `mo_status` — the spine of the state machine (docs/13-integration-contract.md). */
export type MoStatus =
  | "quoting"
  | "proforma_issued"
  | "negotiating"
  | "approved"
  | "declined"
  | "in_review"
  | "review_query"
  | "released"
  | "in_production"
  | "inspection"
  | "packed"
  | "shipped"
  | "arrived"
  | "closed"
  | "cancelled";

/** Statuses at which an order is visible to the seller. Sharik enforces the same list. */
export const SELLER_VISIBLE: MoStatus[] = [
  "released",
  "in_production",
  "inspection",
  "packed",
  "shipped",
  "arrived",
  "closed",
];

/** `review_outcome`. Note there is no `pending` member — pending is `decided_at IS NULL`. */
export type ReviewOutcome = "passed" | "query" | "rejected";

/** `stage_status`. */
export type StageStatus = "pending" | "in_progress" | "completed" | "blocked" | "skipped";

/** `issue_status`. */
export type IssueStatus =
  | "open"
  | "investigating"
  | "proposed"
  | "approved"
  | "resolved"
  | "rejected";

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  name_ar: string | null;
}

export interface Client {
  id: string;
  code: string;
  name: string;
  country: string | null;
  city: string | null;
  currency: string | null;
}

export interface House {
  id: string;
  code: string;
  name: string;
  city: string | null;
  country: string | null;
  specialities: string[] | null;
}

export interface HouseScore {
  house_id: string;
  period_start: string;
  period_end: string;
  on_time_pct: number | null;
  defect_pct: number | null;
  avg_approval_turnaround_hours: number | null;
  orders_count: number | null;
}

export interface ManufacturerOrder {
  id: string;
  tenant_id: string;
  client_id: string | null;
  house_id: string | null;
  number: string;
  status: MoStatus;
  subtotal: number | null;
  total: number | null;
  currency: string;
  lead_time_days: number | null;
  promised_ship_date: string | null;
  expected_arrival_date: string | null;
  declined_reason: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface OrderLine {
  id: string;
  manufacturer_order_id: string;
  style_id: string | null;
  colourway_id: string | null;
  packs: number | null;
  pcs: number | null;
  unit_price: number | null;
  line_total: number | null;
  status: string | null;
}

export interface Style {
  id: string;
  code: string;
  name: string;
  fabric: string | null;
  composition: string | null;
  lead_time_days: number | null;
  moq_packs: number | null;
  base_price: number | null;
}

export interface Colourway {
  id: string;
  style_id: string;
  name: string;
  hex: string | null;
  colour_family: string | null;
  moq_packs: number | null;
}

export interface ProductionStage {
  id: string;
  code: string;
  name: string;
  sort: number;
  typical_duration_days: number | null;
  requires_media: boolean | null;
  client_visible: boolean | null;
}

export interface ProductionEvent {
  id: string;
  manufacturer_order_id: string;
  stage_id: string;
  status: StageStatus;
  qty_in: number | null;
  qty_out: number | null;
  expected_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  note: string | null;
}

export interface Issue {
  id: string;
  issue_type_id: string | null;
  manufacturer_order_id: string | null;
  house_id: string | null;
  client_id: string | null;
  raised_at: string | null;
  description: string | null;
  status: IssueStatus;
  sla_due_at: string | null;
  resolution: string | null;
  cost_impact: number | null;
  days_impact: number | null;
  resolved_at: string | null;
  /** The distinction worth pointing at in the demo: internal issues the client never sees. */
  client_visible: boolean | null;
}

export interface IssueType {
  id: string;
  category: string | null;
  code: string;
  name: string;
  sla_hours: number | null;
}

export interface WorkingLimit {
  id: string;
  client_id: string;
  season: string | null;
  amount: number | null;
  currency: string;
  committed: number | null;
  status: string;
}

/**
 * `order_reviews` — the gate.
 *
 * This is the table the queue is built on. It carries the gate's substance
 * (`checks`, `note`, `decided_at`, a reviewer) but has no `gate_type` column,
 * so every gate it can express is an Order review. See the note in
 * lib/gates.ts for how that shapes the queue.
 */
export interface OrderReview {
  id: string;
  tenant_id: string;
  manufacturer_order_id: string;
  checks: ChecklistState | null;
  outcome: ReviewOutcome | null;
  note: string | null;
  reviewer_id: string | null;
  started_at: string | null;
  decided_at: string | null;
}

/** `order_reviews.checks` — a jsonb map of check key → ticked. */
export type ChecklistState = Record<string, boolean>;
