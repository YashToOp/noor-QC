import type {
  Issue,
  ManufacturerOrder,
  OrderReview,
  ProductionEvent,
  ProductionStage,
} from "./types";
import type { DateRange } from "@/components/ui/date-range-picker";

/**
 * KPI derivation — DESIGN_SYSTEM.md §7.3: "always ship the value, the unit, the
 * comparison period, and the delta badge. A number with no comparison is not a
 * KPI, it is trivia."
 *
 * Honouring that needs a *prior* value, and the schema has no status-history
 * table — `manufacturer_orders` carries only `updated_at`, so you cannot read
 * an order's status as at last Tuesday off that row.
 *
 * What the schema *does* carry is timestamps on the things that move:
 * `order_reviews.started_at` / `decided_at`, `production_events.started_at` /
 * `completed_at` / `expected_at`, and `issues.raised_at` / `resolved_at`. Every
 * measure below is reconstructed point-in-time from those, so each delta
 * compares two genuinely measured values rather than a guess. Nothing here
 * invents a prior number.
 */

export interface Kpi {
  value: number | null;
  previous: number | null;
}

/** Percentage change, or undefined when a delta would be meaningless. */
export function delta(kpi: Kpi): number | undefined {
  if (kpi.value === null || kpi.previous === null || kpi.previous === 0) return undefined;
  return ((kpi.value - kpi.previous) / kpi.previous) * 100;
}

/** The window of equal length immediately preceding `range`. */
export function previousWindow(range: DateRange): DateRange {
  const span = range.to.getTime() - range.from.getTime();
  return {
    from: new Date(range.from.getTime() - span),
    to: new Date(range.from.getTime()),
  };
}

const at = (iso: string | null | undefined) => (iso ? new Date(iso).getTime() : null);

/**
 * Gates pending as at `t`: opened by then, not yet decided by then.
 *
 * This is the *historical* count, used for the comparison figure. The present
 * count is not reconstructed — it is the length of the queue itself, which
 * also picks up gates that ought to be open but have not been written down
 * yet. Pass every review, decided ones included: a gate decided yesterday was
 * still pending last week.
 */
export function pendingGatesAt(reviews: OrderReview[], t: number): number {
  return reviews.filter((r) => {
    const started = at(r.started_at);
    if (started === null || started > t) return false;
    const decided = at(r.decided_at);
    return decided === null || decided > t;
  }).length;
}

/**
 * Orders in production as at `t`: the stage ladder has started and has not
 * finished. Reconstructed from `production_events`, which is the one table
 * that timestamps the transition.
 */
export function inProductionAt(events: ProductionEvent[], t: number): number {
  const byOrder = groupBy(events, (e) => e.manufacturer_order_id);
  let count = 0;
  for (const rows of byOrder.values()) {
    const started = rows.some((e) => {
      const s = at(e.started_at) ?? at(e.completed_at);
      return s !== null && s <= t;
    });
    if (!started) continue;
    const allDone = rows.every((e) => {
      const c = at(e.completed_at);
      return c !== null && c <= t;
    });
    if (!allDone) count += 1;
  }
  return count;
}

/**
 * Value at risk as at `t`: the total of every order carrying an open issue, or
 * a stage that was past its `expected_at` and still not complete.
 *
 * An order is counted once however many ways it is at risk.
 */
export function valueAtRiskAt(
  orders: ManufacturerOrder[],
  issues: Issue[],
  events: ProductionEvent[],
  t: number,
): number {
  const risky = new Set<string>();

  for (const issue of issues) {
    if (!issue.manufacturer_order_id) continue;
    const raised = at(issue.raised_at);
    if (raised === null || raised > t) continue;
    const resolved = at(issue.resolved_at);
    if (resolved === null || resolved > t) risky.add(issue.manufacturer_order_id);
  }

  for (const e of events) {
    if (!e.expected_at) continue;
    const expected = new Date(`${e.expected_at}T23:59:59`).getTime();
    if (expected >= t) continue;
    const done = at(e.completed_at);
    if (done === null || done > t) risky.add(e.manufacturer_order_id);
  }

  return orders
    .filter((o) => risky.has(o.id))
    .reduce((sum, o) => sum + (o.total ?? 0), 0);
}

/**
 * On-time rate over a window: of the orders whose ladder finished inside the
 * window, the share that finished on or before the promised ship date.
 *
 * Returns null when nothing completed in the window — an unknown rate renders
 * as `—`, never as 0% (§5.2).
 */
export function onTimeRate(
  orders: ManufacturerOrder[],
  events: ProductionEvent[],
  stages: ProductionStage[],
  range: DateRange,
): number | null {
  const finalSort = Math.max(...stages.map((s) => s.sort), 0);
  const finalStageIds = new Set(stages.filter((s) => s.sort === finalSort).map((s) => s.id));
  const orderById = new Map(orders.map((o) => [o.id, o]));

  let total = 0;
  let onTime = 0;

  for (const e of events) {
    if (!finalStageIds.has(e.stage_id)) continue;
    const done = at(e.completed_at);
    if (done === null) continue;
    if (done < range.from.getTime() || done > range.to.getTime()) continue;

    const order = orderById.get(e.manufacturer_order_id);
    if (!order?.promised_ship_date) continue;

    total += 1;
    const promised = new Date(`${order.promised_ship_date}T23:59:59`).getTime();
    if (done <= promised) onTime += 1;
  }

  return total === 0 ? null : (onTime / total) * 100;
}

/** Orders whose ladder has a stage past `expected_at` and still incomplete. */
export function ordersBehindSchedule(
  orders: ManufacturerOrder[],
  events: ProductionEvent[],
  stages: ProductionStage[],
  now: number,
): { order: ManufacturerOrder; stage: ProductionStage | null; daysLate: number }[] {
  const stageById = new Map(stages.map((s) => [s.id, s]));
  const worst = new Map<string, { stageId: string; daysLate: number }>();

  for (const e of events) {
    if (!e.expected_at || e.status === "completed" || e.status === "skipped") continue;
    const expected = new Date(`${e.expected_at}T23:59:59`).getTime();
    if (expected >= now) continue;
    const daysLate = Math.floor((now - expected) / 86_400_000);
    const prev = worst.get(e.manufacturer_order_id);
    if (!prev || daysLate > prev.daysLate) {
      worst.set(e.manufacturer_order_id, { stageId: e.stage_id, daysLate });
    }
  }

  return orders
    .filter((o) => worst.has(o.id))
    .map((o) => {
      const w = worst.get(o.id)!;
      return { order: o, stage: stageById.get(w.stageId) ?? null, daysLate: w.daysLate };
    })
    .sort((a, b) => b.daysLate - a.daysLate);
}

function groupBy<T, K>(items: T[], key: (item: T) => K): Map<K, T[]> {
  const out = new Map<K, T[]>();
  for (const item of items) {
    const k = key(item);
    const bucket = out.get(k);
    if (bucket) bucket.push(item);
    else out.set(k, [item]);
  }
  return out;
}

/** Bucket a set of timestamps into ISO week starts, for the weekly trend. */
export function weeklyBuckets(
  dates: (string | null | undefined)[],
  range: DateRange,
): { label: string; value: number }[] {
  const buckets = new Map<number, number>();
  const start = startOfWeek(range.from);

  for (let cursor = new Date(start); cursor <= range.to; cursor.setDate(cursor.getDate() + 7)) {
    buckets.set(cursor.getTime(), 0);
  }

  for (const iso of dates) {
    const t = at(iso);
    if (t === null) continue;
    const week = startOfWeek(new Date(t)).getTime();
    if (!buckets.has(week)) continue;
    buckets.set(week, (buckets.get(week) ?? 0) + 1);
  }

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([ms, value]) => {
      const d = new Date(ms);
      return { label: `${MONTHS[d.getMonth()]} ${d.getDate()}`, value };
    });
}

function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (out.getDay() + 6) % 7; // Monday-first
  out.setDate(out.getDate() - day);
  return out;
}
