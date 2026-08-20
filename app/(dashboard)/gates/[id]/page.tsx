"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Clock } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { StatusBadge } from "@/components/ui/status-badge";
import { Stepper, type Step } from "@/components/ui/stepper";
import { ErrorState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { useGateDetail, useProductionStages, qk } from "@/lib/queries";
import {
  CHECKS_BY_TYPE,
  GATE_ACTIONS,
  GATE_TYPE_LABEL,
  GATE_TYPE_PURPOSE,
  allChecked,
  decideGate,
  emptyChecks,
  gateStatus,
  openGate,
  saveChecks,
  subjectApproval,
  subjectEvent,
  type GateOutcome,
  type GateType,
} from "@/lib/gates";
import { gateBadge, issueBadge, STATUS_LABEL } from "@/lib/status";
import type { ChecklistState, MoStatus } from "@/lib/types";
import {
  formatCount,
  formatDate,
  formatDateTime,
  formatMoney,
  formatMoneyFull,
  formatPercent,
  UNKNOWN,
} from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * GATE DETAIL — build prompt §5.2, now covering all four gate types.
 *
 * Two columns inside the panel: the decision on the left, the context on the
 * right. The left column is the approval stepper (§7.6), the gate's own
 * checklist in a bg-well well, and the actions right-aligned with the primary
 * last (§5.9).
 *
 * `Approve` is the one filled primary button on the screen (Part E). Which
 * other actions appear comes from the contract's gate table, via GATE_ACTIONS:
 * an order review can be queried or rejected, a sample can only be rejected, a
 * stage can only be queried, and a dispatch can only be held.
 */

/** The six steps an order walks, and where this order currently stands. */
const STEP_ORDER: { id: string; label: string; statuses: MoStatus[] }[] = [
  { id: "proforma", label: "Proforma", statuses: ["proforma_issued", "negotiating", "approved"] },
  { id: "review", label: "Order review", statuses: ["in_review", "review_query"] },
  { id: "released", label: "Released", statuses: ["released"] },
  { id: "production", label: "Production", statuses: ["in_production"] },
  { id: "inspection", label: "Inspection", statuses: ["inspection"] },
  { id: "dispatch", label: "Dispatch", statuses: ["packed", "shipped", "arrived", "closed"] },
];

function buildSteps(status: MoStatus): Step[] {
  const currentIndex = STEP_ORDER.findIndex((s) => s.statuses.includes(status));
  // `quoting` sits before the ladder; terminal rejections stop where they were.
  const index = currentIndex === -1 ? 0 : currentIndex;
  return STEP_ORDER.map((s, i) => ({
    id: s.id,
    label: s.label,
    state: i < index ? "done" : i === index ? "current" : "pending",
  }));
}

export default function GateDetailPage() {
  const params = useParams<{ id: string }>();
  const gateKey = decodeURIComponent(params.id);
  const router = useRouter();
  const qc = useQueryClient();
  const toast = useToast();

  const detail = useGateDetail(gateKey);
  const stages = useProductionStages();

  const [checks, setChecks] = React.useState<ChecklistState | null>(null);
  const [busy, setBusy] = React.useState<null | GateOutcome>(null);
  const [prompt, setPrompt] = React.useState<null | "query" | "rejected">(null);
  const [note, setNote] = React.useState("");

  // Seed the local checklist from the row, once the row lands.
  React.useEffect(() => {
    if (detail.data && checks === null) {
      setChecks(detail.data.review?.checks ?? emptyChecks(detail.data.gateType));
    }
  }, [detail.data, checks]);

  // Deep-linked before the queue had a chance to open the gate: open it here.
  React.useEffect(() => {
    const data = detail.data;
    if (!data || data.review) return;
    openGate(data.order, data.gateType)
      .then(() => qc.invalidateQueries({ queryKey: qk.gate(gateKey) }))
      .catch(() => undefined);
  }, [detail.data, gateKey, qc]);

  if (detail.isError) {
    return (
      <>
        <PageHeader title="Gate" breadcrumb={[{ label: "Gate queue", href: "/gates" }]} />
        <Card title="Gate">
          <ErrorState
            thing="this gate"
            reason={(detail.error as Error)?.message}
            onRetry={() => detail.refetch()}
          />
        </Card>
      </>
    );
  }

  if (detail.isLoading || !detail.data || checks === null) {
    return (
      <>
        <PageHeader title="Gate" breadcrumb={[{ label: "Gate queue", href: "/gates" }]} />
        <div className="grid grid-cols-12 gap-4 pt-3">
          <Card title="Decision" className="col-span-7 h-[560px]">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-48 w-full" />
          </Card>
          <Card title="Context" className="col-span-5 h-[560px]">
            <Skeleton className="h-full w-full" />
          </Card>
        </div>
      </>
    );
  }

  const { order, review, client, house, scores, lines, limit, issues, events, approvals, gateType } =
    detail.data;
  const status = gateStatus(order, review);
  const decided = Boolean(review?.decided_at);
  const score = scores[0];
  const openIssues = issues.filter((i) => i.status !== "resolved" && i.status !== "rejected");
  const totalPcs = lines.reduce((sum, l) => sum + (l.pcs ?? 0), 0);
  const actions = GATE_ACTIONS[gateType];

  // The subject each gate is about, derived rather than stored (see lib/gates.ts).
  const sample = gateType === "sample_release" ? subjectApproval(approvals) : null;
  const stageEvent = gateType === "stage_verify" ? subjectEvent(events) : null;

  const toggle = async (key: string) => {
    if (decided || !review) return;
    const next = { ...checks, [key]: !checks[key] };
    setChecks(next);
    try {
      await saveChecks(review.id, next);
    } catch (e) {
      setChecks(checks); // put it back — the write did not land
      toast({
        tone: "error",
        title: "Couldn't save that check",
        description: (e as Error).message,
      });
    }
  };

  const refresh = () => {
    qc.invalidateQueries({ queryKey: qk.gate(gateKey) });
    qc.invalidateQueries({ queryKey: qk.gateQueue });
    qc.invalidateQueries({ queryKey: qk.reviews });
    qc.invalidateQueries({ queryKey: qk.orders });
    qc.invalidateQueries({ queryKey: qk.events });
    qc.invalidateQueries({ queryKey: qk.approvals });
  };

  const decide = async (outcome: GateOutcome, reason?: string) => {
    if (!review) return;
    setBusy(outcome);
    try {
      await decideGate({
        review,
        order,
        outcome,
        checks,
        note: reason,
        stages: stages.data ?? [],
        totalPcs,
        events,
        approvals,
      });
      refresh();
      toast({ tone: "success", title: successMessage(gateType, outcome, order.number) });
      setPrompt(null);
      setNote("");
      router.push("/gates");
    } catch (e) {
      toast({ tone: "error", title: "Couldn't record that", description: (e as Error).message });
    } finally {
      setBusy(null);
    }
  };

  const ready = allChecked(gateType, checks);

  return (
    <>
      <PageHeader
        title={`${GATE_TYPE_LABEL[gateType]} · ${order.number}`}
        breadcrumb={[{ label: "Gate queue", href: "/gates" }]}
        actions={<StatusBadge spec={gateBadge(status)} dot />}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-12 items-start gap-4 pt-3 pb-4">
          {/* ── LEFT: the decision ─────────────────────────────── */}
          <div className="col-span-7 flex flex-col gap-4">
            <Card title={GATE_TYPE_LABEL[gateType]}>
              <p className="-mt-3 text-xs text-ink-secondary">{GATE_TYPE_PURPOSE[gateType]}</p>

              <Stepper steps={buildSteps(order.status)} className="pt-1" />

              {/* The checklist, in a 12px bg-well well. */}
              <div className="mt-2 rounded-lg bg-well p-3">
                <ul className="flex flex-col">
                  {CHECKS_BY_TYPE[gateType].map((check) => {
                    const ticked = checks[check.key] === true;
                    return (
                      <li key={check.key}>
                        <button
                          type="button"
                          disabled={decided}
                          aria-pressed={ticked}
                          onClick={() => toggle(check.key)}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left transition-colors",
                            decided ? "cursor-default" : "hover:bg-item-hover",
                          )}
                        >
                          <span
                            className={cn(
                              "grid size-4 shrink-0 place-items-center rounded-sm",
                              ticked
                                ? "bg-state-success text-white"
                                : "border-hairline border-line bg-surface text-state-warning",
                            )}
                            aria-hidden
                          >
                            {ticked ? (
                              <Check className="size-3" strokeWidth={2.5} />
                            ) : (
                              <Clock className="size-2.5" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1 text-sm text-ink">{check.label}</span>
                          {/* Every row carries a word — never colour alone (§8). */}
                          <span
                            className={cn(
                              "shrink-0 text-xs font-medium",
                              ticked ? "text-[#0a5c37]" : "text-[#7a4a00]",
                            )}
                          >
                            {ticked ? "Confirmed" : "Pending"}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {!ready && !decided && (
                <p className="text-xs text-ink-secondary">
                  Every check must be confirmed before this gate can be approved.
                </p>
              )}

              {decided && review?.note && (
                <p className="rounded-md bg-well p-3 text-xs text-ink-secondary">
                  <span className="font-medium text-ink">Note. </span>
                  {review.note}
                </p>
              )}

              {/*
                Actions right-aligned, primary last (§5.9). Approve is the one
                filled primary on this screen (Part E); while a dialog is open
                it is disabled, so the dialog's confirm is the only *active*
                filled primary in view and the count still holds.
              */}
              {decided ? (
                <p className="text-xs text-ink-secondary">
                  Decided {formatDate(review!.decided_at)} — this gate is closed.
                </p>
              ) : (
                <div className="flex items-center justify-end gap-2">
                  {actions.reject && (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        setPrompt("rejected");
                        setNote("");
                      }}
                      disabled={busy !== null || prompt !== null}
                    >
                      Reject
                    </Button>
                  )}
                  {actions.secondary && (
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setPrompt("query");
                        setNote("");
                      }}
                      disabled={busy !== null || prompt !== null}
                    >
                      {actions.secondary}
                    </Button>
                  )}
                  <Button
                    variant="primary"
                    onClick={() => decide("passed")}
                    loading={busy === "passed"}
                    disabled={!ready || busy !== null || prompt !== null || !review}
                  >
                    Approve
                  </Button>
                </div>
              )}
            </Card>
          </div>

          {/* ── RIGHT: the context ─────────────────────────────── */}
          <div className="col-span-5 flex flex-col gap-4">
            {sample && (
              <Card title="The sample">
                <div className="flex items-center gap-3">
                  <span
                    className="size-10 shrink-0 rounded-md border-hairline border-line"
                    style={{ background: sample.swatch_ref ?? "var(--bg-well)" }}
                    aria-hidden
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium text-ink">
                      {sample.title ?? UNKNOWN}
                    </span>
                    <span className="truncate text-xs text-ink-secondary">
                      {sample.type.replace(/_/g, " ")}
                      {sample.lighting ? ` · ${sample.lighting}` : ""}
                    </span>
                  </span>
                </div>
                <dl className="flex flex-col gap-3 text-sm">
                  <Row label="Current state" value={sample.status.replace(/_/g, " ")} />
                  <Row label="Due" value={sample.due_at ? formatDate(sample.due_at) : UNKNOWN} />
                </dl>
                <p className="text-xs text-ink-secondary">
                  Approving puts this in front of the client on their phone.
                </p>
              </Card>
            )}

            {stageEvent && (
              <Card title="The stage">
                <dl className="flex flex-col gap-3 text-sm">
                  <Row
                    label="Stage"
                    value={events.find((e) => e.id === stageEvent.id)?.stage?.name ?? UNKNOWN}
                  />
                  <Row label="Pieces in" value={formatCount(stageEvent.qty_in)} />
                  <Row label="Pieces out" value={formatCount(stageEvent.qty_out)} />
                  <Row
                    label="Completed"
                    value={
                      stageEvent.completed_at ? formatDateTime(stageEvent.completed_at) : UNKNOWN
                    }
                  />
                  <Row
                    label="Was due"
                    value={stageEvent.expected_at ? formatDate(stageEvent.expected_at) : UNKNOWN}
                  />
                </dl>
                <p className="text-xs text-ink-secondary">
                  Querying sends the stage back to the house to redo.
                </p>
              </Card>
            )}

            <Card title="Order lines">
              <ul className="flex flex-col gap-3">
                {lines.map((line) => (
                  <li key={line.id} className="flex items-center gap-3">
                    <span
                      className="size-8 shrink-0 rounded-md border-hairline border-line"
                      style={{ background: line.colourway?.hex ?? "var(--bg-well)" }}
                      aria-hidden
                    />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium text-ink">
                        {line.style?.name ?? UNKNOWN}
                      </span>
                      <span className="truncate text-xs text-ink-secondary">
                        {line.colourway?.name ?? UNKNOWN} · {line.style?.code ?? UNKNOWN}
                      </span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end">
                      <span className="text-sm tabular-nums text-ink">
                        {formatCount(line.pcs)} pcs
                      </span>
                      <span className="text-xs tabular-nums text-ink-secondary">
                        {formatMoneyFull(line.line_total, order.currency)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between border-t border-line-divider pt-3">
                <span className="text-sm text-ink-secondary">
                  {formatCount(totalPcs)} pieces · {STATUS_LABEL[order.status]}
                </span>
                <span className="text-sm font-medium tabular-nums text-ink">
                  {formatMoneyFull(order.total, order.currency)}
                </span>
              </div>
            </Card>

            <Card title="Client & house">
              <dl className="flex flex-col gap-3 text-sm">
                <Row label="Client" value={client?.name ?? UNKNOWN} />
                <Row
                  label="House"
                  value={house?.name ?? UNKNOWN}
                  hint={house?.city ? `${house.city}${house.country ? `, ${house.country}` : ""}` : undefined}
                />
                <Row
                  label="House on-time"
                  value={score?.on_time_pct != null ? `${formatPercent(score.on_time_pct)}%` : UNKNOWN}
                />
                <Row
                  label="House defects"
                  value={score?.defect_pct != null ? `${formatPercent(score.defect_pct)}%` : UNKNOWN}
                />
                <Row
                  label="Promised ship"
                  value={order.promised_ship_date ? formatDate(order.promised_ship_date) : UNKNOWN}
                />
              </dl>
            </Card>

            <Card title="Working limit">
              {limit ? (
                <WorkingLimit
                  amount={limit.amount ?? 0}
                  committed={limit.committed ?? 0}
                  currency={limit.currency ?? order.currency}
                  season={limit.season}
                />
              ) : (
                <p className="text-sm text-ink-secondary">
                  No working limit is on record for this client.
                </p>
              )}
            </Card>

            <Card title="Open issues">
              {openIssues.length === 0 ? (
                <p className="text-sm text-ink-secondary">Nothing open against this order.</p>
              ) : (
                <ul className="flex flex-col gap-3">
                  {openIssues.map((issue) => (
                    <li key={issue.id} className="flex items-start gap-2">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-state-warning" aria-hidden />
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="text-sm text-ink">{issue.description ?? UNKNOWN}</span>
                        <span className="flex items-center gap-2">
                          <StatusBadge spec={issueBadge(issue.status)} />
                          {!issue.client_visible && (
                            <span className="text-xs text-ink-sub">Internal — not shown to the client</span>
                          )}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          </div>
        </div>
      </div>

      <Dialog
        open={prompt !== null}
        onClose={() => setPrompt(null)}
        title={promptTitle(gateType, prompt)}
        description={promptDescription(gateType, prompt)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPrompt(null)}>
              Cancel
            </Button>
            <Button
              variant={prompt === "rejected" ? "destructive" : "primary"}
              disabled={!note.trim()}
              loading={busy === prompt}
              onClick={() => decide(prompt!, note.trim())}
            >
              {promptConfirm(gateType, prompt)}
            </Button>
          </>
        }
      >
        <Input
          label="Reason"
          placeholder={
            prompt === "rejected" ? "Why this cannot proceed" : "What needs to change, and by whom"
          }
          value={note}
          onChange={(e) => setNote(e.target.value)}
          autoFocus
        />
      </Dialog>
    </>
  );
}

function successMessage(type: GateType, outcome: GateOutcome, number: string): string {
  if (outcome === "passed") {
    switch (type) {
      case "order_review":
        return `${number} released to the house`;
      case "sample_release":
        return "Sample sent to the client";
      case "stage_verify":
        return "Stage verified";
      case "dispatch":
        return `${number} cleared to ship`;
    }
  }
  if (outcome === "rejected") return `${number} rejected`;
  return type === "dispatch" ? `${number} held` : "Sent back";
}

function promptTitle(type: GateType, prompt: "query" | "rejected" | null): string {
  if (prompt === "rejected") {
    return type === "sample_release" ? "Reject this sample" : "Reject this order";
  }
  if (type === "dispatch") return "Hold this shipment";
  if (type === "stage_verify") return "Send this stage back";
  return "Send a query to the client";
}

function promptDescription(type: GateType, prompt: "query" | "rejected" | null): string {
  if (prompt === "rejected") {
    return type === "sample_release"
      ? "The sample goes back to the house for a re-dye rather than to the client."
      : "This is terminal. The reason is recorded against the order and shown to the client.";
  }
  if (type === "dispatch") return "The order stays where it is and does not ship.";
  if (type === "stage_verify") return "The stage stops counting as done and the house must redo it.";
  return "The order goes back to the client with your question.";
}

function promptConfirm(type: GateType, prompt: "query" | "rejected" | null): string {
  if (prompt === "rejected") return type === "sample_release" ? "Reject sample" : "Reject order";
  if (type === "dispatch") return "Hold shipment";
  if (type === "stage_verify") return "Send back";
  return "Send query";
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-ink-secondary">{label}</dt>
      <dd className="min-w-0 text-right">
        <span className="block truncate font-medium text-ink">{value}</span>
        {hint && <span className="block truncate text-xs text-ink-secondary">{hint}</span>}
      </dd>
    </div>
  );
}

/** Headroom against the client's declared working limit, with a word for the level (§7.4, §8). */
function WorkingLimit({
  amount,
  committed,
  currency,
  season,
}: {
  amount: number;
  committed: number;
  currency: string;
  season: string | null;
}) {
  const headroom = amount - committed;
  const used = amount > 0 ? (committed / amount) * 100 : 0;
  const level = used >= 100 ? "Exhausted" : used >= 80 ? "Tight" : "Healthy";
  const colour = used >= 100 ? "#fb3748" : used >= 80 ? "#ff8800" : "#1fc16b";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="text-sm text-ink-secondary">{season ?? "Current season"}</span>
        <span className="text-sm font-medium" style={{ color: colour }}>
          {level}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-well" aria-hidden>
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.min(100, used)}%`, background: colour }}
        />
      </div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="text-ink-secondary">Headroom</span>
        <span className="font-medium tabular-nums text-ink">
          {formatMoney(headroom, currency)} of {formatMoney(amount, currency)}
        </span>
      </div>
    </div>
  );
}
