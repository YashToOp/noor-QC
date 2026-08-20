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
  claims_count: number | null;
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
 * `app_users` — the people attached to a party.
 *
 * This is the only table carrying a phone number: neither `clients` nor
 * `houses` has one, so a contact is how a party is reachable and how a phone
 * search resolves to a party.
 */
export interface AppUser {
  id: string;
  role: string;
  client_id: string | null;
  house_id: string | null;
  display_name: string | null;
  phone: string | null;
  locale: string | null;
  order_value_limit: number | null;
  status: string;
}

export interface Invoice {
  id: string;
  client_id: string | null;
  manufacturer_order_id: string | null;
  number: string;
  amount: number | null;
  currency: string;
  issued_at: string | null;
  due_at: string | null;
}

export interface Payment {
  id: string;
  client_id: string | null;
  amount: number | null;
  currency: string;
  method: string | null;
  reference: string | null;
  received_at: string | null;
}

export interface CreditNote {
  id: string;
  client_id: string | null;
  manufacturer_order_id: string | null;
  issue_id: string | null;
  number: string;
  amount: number | null;
  currency: string;
  reason: string | null;
  issued_at: string | null;
}

/** `ledger_kind` — how a ledger row moves the balance. */
export type LedgerKind = "invoice" | "payment" | "credit_note" | "adjustment";

export interface LedgerEntry {
  id: string;
  client_id: string | null;
  kind: LedgerKind;
  ref_type: string | null;
  ref_id: string | null;
  amount: number | null;
  currency: string;
  occurred_at: string | null;
  description: string | null;
}

export interface Enquiry {
  id: string;
  client_id: string | null;
  basket_id: string | null;
  number: string;
  requested_delivery_from: string | null;
  requested_delivery_to: string | null;
  status: string;
  submitted_at: string | null;
}

/** `events` — the audit log. Seeded empty; see lib/profile.ts. */
export interface AuditEvent {
  id: number;
  actor_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  action: string | null;
  created_at: string | null;
}

/** `approval_status`. */
export type ApprovalStatus =
  | "pending"
  | "approved"
  | "revision_requested"
  | "conditional"
  | "superseded"
  | "expired";

/** `approval_type`. */
export type ApprovalType = "lab_dip" | "pp_sample" | "size_set" | "inspection" | "artwork";

/**
 * `approvals` — a sample or shade put to the client.
 *
 * Majlis subscribes to this table filtered on `status = 'pending'`, so moving
 * a row there is what makes the sample visible to the client. That is exactly
 * the effect a `sample_release` gate applies when it passes.
 */
export interface Approval {
  id: string;
  manufacturer_order_id: string | null;
  order_line_id: string | null;
  type: ApprovalType;
  title: string | null;
  swatch_ref: string | null;
  lighting: string | null;
  due_at: string | null;
  status: ApprovalStatus;
  decision: string | null;
  reason: string | null;
  decided_at: string | null;
}

/** `gate_type` — the discriminator that lets `order_reviews` hold all four gates. */
export type GateTypeValue = "order_review" | "sample_release" | "stage_verify" | "dispatch";

/**
 * `order_reviews` — the gate.
 *
 * The table is named for the first gate that existed, but `gate_type` now
 * discriminates all four the contract describes. It carries the gate's
 * substance (`checks`, `note`, `decided_at`, a reviewer) and no subject
 * column — see lib/gates.ts for how each gate's subject is derived, and why a
 * partial unique index is what makes that safe.
 */
export interface OrderReview {
  id: string;
  tenant_id: string;
  manufacturer_order_id: string;
  gate_type: GateTypeValue;
  checks: ChecklistState | null;
  outcome: ReviewOutcome | null;
  note: string | null;
  reviewer_id: string | null;
  started_at: string | null;
  decided_at: string | null;
}

/** `order_reviews.checks` — a jsonb map of check key → ticked. */
export type ChecklistState = Record<string, boolean>;
