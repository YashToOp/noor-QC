/**
 * Number, money and duration formatting — DESIGN_SYSTEM.md §5.2.
 *
 * "Apply these consistently or the dashboard will feel amateur."
 *   - Currency: abbreviate above 5 digits; full precision in tooltips and tables only
 *   - Counts: thousands separators, no decimals
 *   - Percentages: one decimal, the % as a smaller sibling (see PercentValue)
 *   - Durations: `34s`, `4m 12s`, `2h 05m` — never raw seconds
 *   - Zero renders `0`; unknown renders `—` in text-ink-disabled
 */

/** The em-dash used for *unknown*. Never used for zero. */
export const UNKNOWN = "—";

/** Counts: thousands separators, no decimals. */
export function formatCount(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return UNKNOWN;
  return new Intl.NumberFormat("en-IN").format(Math.round(n));
}

/**
 * Full precision money — for tables and tooltips only (§5.2).
 *
 * "Full precision" is taken literally: a value with a fractional part keeps its
 * minor units, because a unit price of 11.60 rounded to 12 is a different
 * number, not a tidier one. Whole amounts stay whole rather than growing a
 * pointless `.00`.
 */
export function formatMoneyFull(
  n: number | null | undefined,
  currency = "USD",
): string {
  if (n === null || n === undefined || Number.isNaN(n)) return UNKNOWN;
  const hasFraction = Math.abs(n % 1) > Number.EPSILON;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    minimumFractionDigits: hasFraction ? 2 : 0,
    maximumFractionDigits: hasFraction ? 2 : 0,
  }).format(n);
}

const SYMBOL: Record<string, string> = { USD: "$", INR: "₹", EUR: "€", GBP: "£", AED: "AED " };

/**
 * Abbreviated money for KPIs and axes — abbreviate above 5 digits (§5.2).
 * INR abbreviates on the lakh/crore scale, everything else on K/M/B.
 */
export function formatMoney(
  n: number | null | undefined,
  currency = "USD",
): string {
  if (n === null || n === undefined || Number.isNaN(n)) return UNKNOWN;
  const sym = SYMBOL[currency] ?? `${currency} `;
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";

  // Below 5 digits, show it in full — abbreviation only kicks in above 99,999.
  if (abs < 100_000) return `${sign}${sym}${new Intl.NumberFormat("en-IN").format(Math.round(abs))}`;

  if (currency === "INR") {
    if (abs >= 10_000_000) return `${sign}${sym}${trim(abs / 10_000_000)}Cr`;
    return `${sign}${sym}${trim(abs / 100_000)}L`;
  }
  if (abs >= 1_000_000_000) return `${sign}${sym}${trim(abs / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${sign}${sym}${trim(abs / 1_000_000)}M`;
  return `${sign}${sym}${trim(abs / 1_000)}K`;
}

function trim(v: number): string {
  return v >= 100 ? v.toFixed(0) : v.toFixed(1).replace(/\.0$/, "");
}

/** Compact axis tick formatter (§6.4 `tickFormatter={compact}`). */
export function compact(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `${trim(n / 1_000_000)}M`;
  if (abs >= 1_000) return `${trim(n / 1_000)}K`;
  return `${n}`;
}

/** Percentages: one decimal. The `%` is rendered as a separate smaller sibling. */
export function formatPercent(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return UNKNOWN;
  return n.toFixed(1);
}

/**
 * Durations — `34s`, `4m 12s`, `2h 05m`, `3d 04h`. Never raw minutes (§5.2).
 * This is what the gate queue's "Waiting" column renders.
 */
export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return UNKNOWN;
  const s = Math.max(0, Math.floor(ms / 1000));
  if (s < 60) return `${s}s`;

  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${pad(s % 60)}s`;

  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${pad(m % 60)}m`;

  const d = Math.floor(h / 24);
  return `${d}d ${pad(h % 24)}h`;
}

/** Elapsed time since an ISO timestamp, formatted per §5.2. */
export function formatWaiting(since: string | null | undefined, now: number): string {
  if (!since) return UNKNOWN;
  return formatDuration(now - new Date(since).getTime());
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** `MMM d` — narrow charts and dense cells. */
export function formatDateShort(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return UNKNOWN;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`;
}

/** `MMM d, yyyy` — wide charts, tooltips and detail pages (§6.1). */
export function formatDate(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return UNKNOWN;
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** `MMM d, yyyy · HH:mm` — audit trails and decision stamps. */
export function formatDateTime(value: string | Date | null | undefined): string {
  const d = toDate(value);
  if (!d) return UNKNOWN;
  return `${formatDate(d)} · ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Whole days between two dates, positive when `b` is later. */
export function daysBetween(a: Date | string, b: Date | string): number {
  const da = toDate(a)!;
  const db = toDate(b)!;
  return Math.round((db.getTime() - da.getTime()) / 86_400_000);
}
