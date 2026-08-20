import { billMatches, billSubtitle } from "./bill";
import type { AppUser, Client, House, Invoice, ManufacturerOrder } from "./types";

/**
 * PARTNER SEARCH
 *
 * One box that finds a client or a house by whatever the operator happens to
 * have in front of them: a name, a code, an order-paper UUID, a city, or a
 * phone number off a WhatsApp message.
 *
 * **Phone lives on `app_users`, not on `clients` or `houses`.** Neither party
 * table has a phone column; contacts hang off them by `client_id` / `house_id`.
 * So a phone search matches a contact and resolves to the party they belong
 * to, and the result says which contact matched — otherwise a hit on a number
 * the operator typed looks like magic rather than a fact.
 *
 * The box also takes a **bill number**, which is the identifier everyone
 * outside this building actually holds. A bill hit outranks every party hit:
 * `INV-2026-0158` can only mean one thing, where a name fragment can mean
 * several, so when the operator types a bill number they are not browsing.
 */

export type PartyKind = "client" | "house";
export type HitKind = PartyKind | "invoice";

export interface SearchHit {
  kind: HitKind;
  id: string;
  /** Party name — the primary identifier in the result row. */
  title: string;
  /** Code, city, country — the disambiguating line. */
  subtitle: string;
  /**
   * Why this row matched. A search that spans six fields has to say which one
   * it hit, or the operator cannot tell a name match from a phone match.
   */
  matchedOn: string;
  href: string;
}

/** Strip everything but digits, so `+967 711 234 567` matches `711234567`. */
export function normalisePhone(value: string): string {
  return value.replace(/\D/g, "");
}

function contains(haystack: string | null | undefined, needle: string): boolean {
  return Boolean(haystack && haystack.toLowerCase().includes(needle));
}

/**
 * Rank a hit so exact identifiers beat fuzzy text.
 * Lower sorts first.
 */
function rank(matchedOn: string): number {
  if (matchedOn.startsWith("Bill")) return 0;
  if (matchedOn.startsWith("Order")) return 1;
  if (matchedOn.startsWith("Code")) return 2;
  if (matchedOn.startsWith("ID")) return 3;
  if (matchedOn.startsWith("Name")) return 4;
  if (matchedOn.startsWith("Phone")) return 5;
  if (matchedOn.startsWith("Contact")) return 6;
  return 7;
}

export interface SearchInput {
  query: string;
  clients: Client[];
  houses: House[];
  users: AppUser[];
  /** Bills. Optional so callers that only want partners need not fetch them. */
  invoices?: Invoice[];
  /** Needed to name the order a bill covers, and to match on its number. */
  orders?: ManufacturerOrder[];
}

/**
 * Match clients and houses against one query string.
 *
 * Runs in the browser over the full party list, which is the right call at
 * this size: the tenant has one client and four houses, and the whole set is
 * already cached for the sidebar and the scope bar. If the partner list ever
 * reaches the thousands this wants to become a Postgres `ilike` / trigram
 * query behind a debounce — the shape of `SearchHit` would not change.
 */
export function searchParties({
  query,
  clients,
  houses,
  users,
  invoices = [],
  orders = [],
}: SearchInput): SearchHit[] {
  const raw = query.trim();
  if (!raw) return [];

  const q = raw.toLowerCase();
  const digits = normalisePhone(raw);
  // Two digits of a phone number matches everything; require a real fragment.
  const phoneSearch = digits.length >= 3;

  const hits: SearchHit[] = [];

  const contactsFor = (predicate: (u: AppUser) => boolean) => users.filter(predicate);

  const addParty = (
    kind: PartyKind,
    id: string,
    title: string,
    subtitle: string,
    fields: { code: string | null; city: string | null; country: string | null },
    contacts: AppUser[],
  ) => {
    let matchedOn: string | null = null;

    if (contains(fields.code, q)) matchedOn = `Code ${fields.code}`;
    else if (id.toLowerCase().startsWith(q) && q.length >= 4) matchedOn = `ID ${id.slice(0, 8)}…`;
    else if (contains(title, q)) matchedOn = "Name";
    else if (phoneSearch) {
      const byPhone = contacts.find((u) => normalisePhone(u.phone ?? "").includes(digits));
      if (byPhone) matchedOn = `Phone ${byPhone.phone} · ${byPhone.display_name ?? "contact"}`;
    }

    if (!matchedOn) {
      const byContact = contacts.find((u) => contains(u.display_name, q));
      if (byContact) matchedOn = `Contact ${byContact.display_name}`;
    }
    if (!matchedOn && (contains(fields.city, q) || contains(fields.country, q))) {
      matchedOn = `Location ${[fields.city, fields.country].filter(Boolean).join(", ")}`;
    }

    if (!matchedOn) return;

    hits.push({
      kind,
      id,
      title,
      subtitle,
      matchedOn,
      href: kind === "client" ? `/clients/${id}` : `/houses/${id}`,
    });
  };

  for (const c of clients) {
    addParty(
      "client",
      c.id,
      c.name,
      [c.code, [c.city, c.country].filter(Boolean).join(", ")].filter(Boolean).join(" · "),
      { code: c.code, city: c.city, country: c.country },
      contactsFor((u) => u.client_id === c.id),
    );
  }

  for (const h of houses) {
    addParty(
      "house",
      h.id,
      h.name,
      [h.code, [h.city, h.country].filter(Boolean).join(", ")].filter(Boolean).join(" · "),
      { code: h.code, city: h.city, country: h.country },
      contactsFor((u) => u.house_id === h.id),
    );
  }

  // ── Bills ─────────────────────────────────────────────────────────────
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const clientById = new Map(clients.map((c) => [c.id, c]));
  const houseById = new Map(houses.map((h) => [h.id, h]));

  for (const inv of invoices) {
    const order = inv.manufacturer_order_id
      ? orderById.get(inv.manufacturer_order_id) ?? null
      : null;
    if (!billMatches(inv.number, order?.number ?? null, raw)) continue;

    const client = inv.client_id ? clientById.get(inv.client_id) ?? null : null;
    const house = order?.house_id ? houseById.get(order.house_id) ?? null : null;

    hits.push({
      kind: "invoice",
      id: inv.id,
      title: inv.number,
      subtitle: billSubtitle(client?.name ?? null, order?.number ?? null, house?.name ?? null),
      // Say which of the two numbers matched: an operator who typed an order
      // number needs to know the row they got back is the bill for it.
      matchedOn: inv.number.toLowerCase().includes(q)
        ? `Bill ${inv.number}`
        : order && order.number.toLowerCase().includes(q)
          ? `Order ${order.number}`
          : `Bill ${inv.number}`,
      href: `/invoices/bill/${inv.id}`,
    });
  }

  return hits.sort((a, b) => {
    const byRank = rank(a.matchedOn) - rank(b.matchedOn);
    return byRank !== 0 ? byRank : a.title.localeCompare(b.title);
  });
}
