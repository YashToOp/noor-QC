import type { IssueStatus, MoStatus } from "./types";

/**
 * Status mapping — build prompt Part D, rendered through the six badge states
 * that DESIGN_SYSTEM.md §5.8 allows. The state machine has more states than
 * that; they map onto six buckets. There is no seventh badge.
 */
export type BadgeTone =
  | "draft"
  | "pending"
  | "active"
  | "progress"
  | "rejected"
  | "closed";

export interface BadgeSpec {
  tone: BadgeTone;
  /** The word. Colour never carries the meaning on its own (§8). */
  label: string;
}

/** §5.8 — light background + dark text from the same hue. Exactly six rows. */
export const BADGE_STYLE: Record<BadgeTone, { bg: string; fg: string }> = {
  draft: { bg: "#f5f5fa", fg: "#606a78" },
  pending: { bg: "#fbf5e0", fg: "#7a4a00" },
  active: { bg: "#d1fae5", fg: "#0a5c37" },
  progress: { bg: "#ebf1ff", fg: "#122368" },
  rejected: { bg: "#ffebec", fg: "#8c1a20" },
  closed: { bg: "#f5f5fa", fg: "#8793a3" },
};

const ORDER_BADGE: Record<MoStatus, BadgeSpec> = {
  // Pending
  proforma_issued: { tone: "pending", label: "Pending" },
  approved: { tone: "pending", label: "Pending" },
  in_review: { tone: "pending", label: "Pending" },
  // In progress
  negotiating: { tone: "progress", label: "In progress" },
  review_query: { tone: "progress", label: "In progress" },
  // Active
  released: { tone: "active", label: "Active" },
  in_production: { tone: "active", label: "Active" },
  inspection: { tone: "active", label: "Active" },
  packed: { tone: "active", label: "Active" },
  shipped: { tone: "active", label: "Active" },
  // Rejected
  declined: { tone: "rejected", label: "Rejected" },
  // Closed
  arrived: { tone: "closed", label: "Closed" },
  closed: { tone: "closed", label: "Closed" },
  // `cancelled` is §5.8's own "Cancelled / Closed" bucket, not a seventh badge.
  cancelled: { tone: "closed", label: "Closed" },
  // `quoting` precedes the proforma — nothing has been issued yet.
  quoting: { tone: "draft", label: "Draft" },
};

export function orderBadge(status: MoStatus | null | undefined): BadgeSpec {
  if (!status) return { tone: "draft", label: "Draft" };
  return ORDER_BADGE[status] ?? { tone: "draft", label: "Draft" };
}

/** Gate status → badge. `pending → Pending`, `approved → Active`, `query → In progress`, `rejected → Rejected`. */
export type GateStatus = "pending" | "approved" | "query" | "rejected";

export function gateBadge(status: GateStatus): BadgeSpec {
  switch (status) {
    case "pending":
      return { tone: "pending", label: "Pending" };
    case "approved":
      return { tone: "active", label: "Approved" };
    case "query":
      return { tone: "progress", label: "Query" };
    case "rejected":
      return { tone: "rejected", label: "Rejected" };
  }
}

export function issueBadge(status: IssueStatus): BadgeSpec {
  switch (status) {
    case "open":
      return { tone: "rejected", label: "Open" };
    case "investigating":
    case "proposed":
      return { tone: "progress", label: status === "proposed" ? "Proposed" : "Investigating" };
    case "approved":
      return { tone: "pending", label: "Approved" };
    case "resolved":
      return { tone: "active", label: "Resolved" };
    case "rejected":
      return { tone: "rejected", label: "Rejected" };
  }
}

/** Human-readable state-machine label, for timelines and detail pages. */
export const STATUS_LABEL: Record<MoStatus, string> = {
  quoting: "Quoting",
  proforma_issued: "Proforma issued",
  negotiating: "Negotiating",
  approved: "Client approved",
  declined: "Declined",
  in_review: "In review",
  review_query: "Query with client",
  released: "Released",
  in_production: "In production",
  inspection: "Inspection",
  packed: "Packed",
  shipped: "Shipped",
  arrived: "Arrived",
  closed: "Closed",
  cancelled: "Cancelled",
};

/**
 * Approval (sample / shade) status → badge. `approval_status` has six members
 * and §5.8 allows six badge states, but they are not the same six — these map
 * onto the buckets by what the state *means to the operator*, not by name.
 */
export function approvalBadge(status: string): BadgeSpec {
  switch (status) {
    case "pending":
      return { tone: "pending", label: "With client" };
    case "approved":
      return { tone: "active", label: "Approved" };
    case "revision_requested":
      return { tone: "progress", label: "Revision asked" };
    case "conditional":
      return { tone: "progress", label: "Conditional" };
    case "superseded":
      return { tone: "closed", label: "Superseded" };
    case "expired":
      return { tone: "rejected", label: "Expired" };
    default:
      return { tone: "draft", label: "Draft" };
  }
}

/** `enquiry_status` → badge. */
export function enquiryBadge(status: string): BadgeSpec {
  switch (status) {
    case "draft":
      return { tone: "draft", label: "Draft" };
    case "submitted":
      return { tone: "pending", label: "Submitted" };
    case "quoting":
      return { tone: "progress", label: "Quoting" };
    case "quoted":
      return { tone: "active", label: "Quoted" };
    case "closed":
      return { tone: "closed", label: "Closed" };
    default:
      return { tone: "draft", label: "Draft" };
  }
}

/** Sample/shade type, spelled out. */
export const APPROVAL_TYPE_LABEL: Record<string, string> = {
  lab_dip: "Lab dip",
  pp_sample: "Pre-production sample",
  size_set: "Size set",
  inspection: "Inspection",
  artwork: "Artwork",
};
