# Demo data

The `noor-demo` Supabase project carries two layers of data. Nothing here is
schema — no table, column, enum or view was added for it. It is rows only, in
the tables the three surfaces already share.

## Layer 1 — the original seed

One tenant (Noor Textiles), one client (Al-Rashid Trading), four houses, ten
styles, nine orders. Ids are of the shape `X0000000-0000-4000-a000-…`.

## Layer 2 — the synthetic demonstration set

Injected so the dashboard has a year of history to draw, a partner list worth
searching, and a bill worth looking up. **Every seeded row carries an `a` in
the second nibble of its id**, so the whole layer is identifiable — and
removable — with a single `like` per table:

| Table | Id prefix | Rows |
| --- | --- | --- |
| `app_users` (+ matching `auth.users`) | `2a000000-` | 22 |
| `clients` | `3a000000-` | 15 |
| `houses` | `4a000000-` | 6 |
| `styles` | `70a00000-` | 12 |
| `colourways` | `71a00000-` | 27 |
| `ratio_packs` | `72a00000-` | 12 |
| `media_assets` | `90a00000-` | 13 |
| `enquiries` | `7ba00000-` | 42 |
| `manufacturer_orders` | `7ca00000-` | 54 |
| `manufacturer_order_lines` | `83a00000-` | 81 |
| `order_reviews` (gates) | `84a00000-` | 108 |
| `production_events` | `7ea00000-` | 287 |
| `approvals` | `7fa00000-` | 82 |
| `issue_types` | `81a00000-` | 3 |
| `issues` | `82a00000-` | 16 |
| `invoices` | `80a10000-` | 41 |
| `payments` | `80a30000-` | 66 |
| `credit_notes` | `80a50000-` | 3 |
| `ledger_entries` | `80a20000-` / `80a40000-` / `80a60000-` | 110 |
| `house_scores` | `85a00000-` | 25 |
| `sample_requests` | `86a00000-` | 8 |

Ids are `md5` of the row's natural key, so the set is deterministic: running
the same insert twice produces the same ids and the second run is a no-op.

### What makes it read as real

The point of synthetic data is not volume, it is that nothing in it contradicts
anything else. The set is built so that:

- **Every order foots.** `line_total = pcs × unit_price`, `subtotal = Σ lines`,
  `total = subtotal + freight + packing`. Freight runs 2.6–3.8% of subtotal and
  packing 1.0–1.4%, which is where the original seed's orders sit.
- **Time only runs forwards.** An enquiry precedes its orders, an order precedes
  its stages, a gate opens before it is decided, an invoice follows the order it
  bills, and nothing on the factory floor has happened in the future.
- **The ladder decides the promise, not the enquiry.** A promised ship date is
  the release date plus the seven stages' typical durations, plus a few days'
  slack either way — so one order is behind schedule rather than all of them.
- **Gates are signed.** Decided gates carry a `reviewer_id` drawn from the five
  Noor staff, which is what the bill dossier reads for "confirmed by".
- **Outcomes are mixed.** Scorecards trend up but each house has one bad
  quarter; eight issues are live and two of those are past SLA; five samples
  sit with clients and two are overdue.

### Known cosmetic artifact

Five of the 2026 enquiry numbers fall out of date order, because in-flight
orders were re-timed to sit against today after their numbers were allocated.
Real systems pre-allocate serials and see the same thing, so it was left alone
rather than renumbering — renumbering would rewrite order numbers, which are
quoted in invoice descriptions, ledger lines and credit-note reasons.
