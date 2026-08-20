import { supabase } from "./supabase";
import type { Issue, IssueStatus, IssueType } from "./types";

/**
 * THE ISSUE MODEL
 *
 * The write map gives this dashboard exactly one verb on `issues`: **resolve**.
 * Majlis and Sharik raise them; nobody else moves them along. So everything
 * here writes `status`, `resolution`, `cost_impact`, `days_impact` and
 * `resolved_at`, and nothing else.
 *
 * In particular `client_visible` is deliberately **read-only** here. Whoever
 * raises an issue decides whether the client sees it, and flipping that from
 * the resolver's chair would quietly rewrite what the client was told. The
 * page shows the flag and never offers to change it.
 */

/**
 * `issue_status` is a six-state ladder, and the contract does not spell out the
 * transitions, so they are read straight off the enum's own ordering:
 *
 *   open → investigating → proposed → approved → resolved
 *
 * with `rejected` reachable from anywhere before the end. Each step is a real
 * moment in how Noor actually handles a problem: you pick it up, you work out
 * what to do, you put the fix to whoever pays for it, they agree, it is done.
 */
export const ISSUE_TERMINAL: IssueStatus[] = ["resolved", "rejected"];

export function isOpen(issue: Pick<Issue, "status">): boolean {
  return !ISSUE_TERMINAL.includes(issue.status);
}

export interface IssueAction {
  to: IssueStatus;
  label: string;
  /** Proposing a fix is the one step that needs more than a click. */
  needsResolution?: boolean;
}

/** The forward step available from each state, or null at the end of the road. */
export function nextAction(status: IssueStatus): IssueAction | null {
  switch (status) {
    case "open":
      return { to: "investigating", label: "Start investigating" };
    case "investigating":
      return { to: "proposed", label: "Propose a fix", needsResolution: true };
    case "proposed":
      return { to: "approved", label: "Approve the fix" };
    case "approved":
      return { to: "resolved", label: "Mark resolved" };
    default:
      return null;
  }
}

/** Every state that is not already finished can be rejected outright. */
export function canReject(status: IssueStatus): boolean {
  return !ISSUE_TERMINAL.includes(status);
}

export const ISSUE_STATUS_LABEL: Record<IssueStatus, string> = {
  open: "Open",
  investigating: "Investigating",
  proposed: "Fix proposed",
  approved: "Fix approved",
  resolved: "Resolved",
  rejected: "Rejected",
};

/* ────────────────────────────────────────────────────────────────────────
   SLA
   ──────────────────────────────────────────────────────────────────────── */

/**
 * When this issue is due.
 *
 * `issues.sla_due_at` is nullable and the seeded rows leave it null, but
 * `issue_types.sla_hours` is populated — so the deadline is derivable from the
 * type and the moment it was raised. The stored value wins when present; this
 * is a display-only computation, not a column anybody needs to add.
 */
export function slaDueAt(
  issue: Pick<Issue, "sla_due_at" | "raised_at">,
  type: Pick<IssueType, "sla_hours"> | null | undefined,
): string | null {
  if (issue.sla_due_at) return issue.sla_due_at;
  if (!type?.sla_hours || !issue.raised_at) return null;
  return new Date(
    new Date(issue.raised_at).getTime() + type.sla_hours * 3_600_000,
  ).toISOString();
}

export type SlaState = "breached" | "due-soon" | "on-track" | "met" | "missed" | "unknown";

/** Every SLA state carries a word on the page — never a colour on its own (§8). */
export const SLA_LABEL: Record<SlaState, string> = {
  breached: "Breached",
  "due-soon": "Due soon",
  "on-track": "On track",
  met: "Met",
  missed: "Missed",
  unknown: "No SLA",
};

export const SLA_COLOUR: Record<SlaState, string> = {
  breached: "#8c1a20",
  "due-soon": "#7a4a00",
  "on-track": "#606a78",
  met: "#0a5c37",
  missed: "#8c1a20",
  unknown: "#8793a3",
};

/**
 * Where this issue stands against its deadline.
 *
 * A finished issue is judged on when it actually landed — `met` or `missed` —
 * rather than being reported as breached forever after.
 */
export function slaState(
  issue: Pick<Issue, "sla_due_at" | "raised_at" | "status" | "resolved_at">,
  type: Pick<IssueType, "sla_hours"> | null | undefined,
  now: number,
): SlaState {
  const due = slaDueAt(issue, type);
  if (!due) return "unknown";
  const dueMs = new Date(due).getTime();

  if (ISSUE_TERMINAL.includes(issue.status)) {
    if (!issue.resolved_at) return "unknown";
    return new Date(issue.resolved_at).getTime() <= dueMs ? "met" : "missed";
  }

  if (now > dueMs) return "breached";
  // Inside the last quarter of the window is "due soon".
  const raised = issue.raised_at ? new Date(issue.raised_at).getTime() : dueMs;
  const window = dueMs - raised;
  return now > dueMs - window * 0.25 ? "due-soon" : "on-track";
}

/* ────────────────────────────────────────────────────────────────────────
   Writes
   ──────────────────────────────────────────────────────────────────────── */

export interface TransitionArgs {
  issue: Issue;
  to: IssueStatus;
  /** The fix, when proposing one. */
  resolution?: string;
  costImpact?: number | null;
  daysImpact?: number | null;
}

/**
 * Move an issue along the ladder.
 *
 * Guarded on the status the caller believed it was in, so two operators
 * working the same list cannot double-advance a row: the second write matches
 * nothing and says so rather than skipping a state silently.
 */
export async function transitionIssue(args: TransitionArgs): Promise<void> {
  const { issue, to, resolution, costImpact, daysImpact } = args;

  const patch: Record<string, unknown> = { status: to };

  if (resolution !== undefined) patch.resolution = resolution;
  if (costImpact !== undefined) patch.cost_impact = costImpact;
  if (daysImpact !== undefined) patch.days_impact = daysImpact;

  // `resolved_at` is what every duration measure keys off, so it is stamped
  // exactly once, when the issue actually finishes.
  if (ISSUE_TERMINAL.includes(to)) patch.resolved_at = new Date().toISOString();

  const { data, error } = await supabase()
    .from("issues")
    .update(patch)
    .eq("id", issue.id)
    .eq("status", issue.status)
    .select("id");

  if (error) throw error;
  if (!data?.length) {
    throw new Error(
      "This issue has already moved on — it was changed in another window.",
    );
  }
}
