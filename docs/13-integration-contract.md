# THE INTEGRATION CONTRACT
### The single source of truth for how Majlis, Sharik and the QC dashboard share one database.
### If these three apps ever disagree, it is because someone broke this file.

---

## RULE ZERO — ONE SUPABASE PROJECT

All three apps use **the same Supabase project, the same URL, the same anon key.**

```
SUPABASE_URL       = <identical in all three>
SUPABASE_ANON_KEY  = <identical in all three>
```

**Never** create a second project "just for the seller app". **Never** run a migration from the second or third app. The schema is created once, by whoever builds first, and every app after that only reads and writes what already exists.

> If you find yourself wanting a column that does not exist, **stop and say so.** Do not add it locally — it will silently diverge and the wiring will break at the worst possible moment, which is in front of the customer.

---

## THE WRITE MAP
### Exactly one app owns each write. Nobody else touches it.

| Table | Majlis (client) | Sharik (seller) | QC dashboard | Notes |
|---|---|---|---|---|
| `clients` | — | — | — | seeded |
| `houses` | — | — | — | seeded |
| `styles`, `colourways` | — | *(V1: create)* | — | seeded for the demo |
| `baskets`, `basket_lines` | **writes** | never | never | client-owned |
| `enquiries` | **creates** | never | never | on Send to Noor |
| `manufacturer_orders` | **status only** → `approved` / `declined` | **status only** → `in_production` | **everything else** | see the state machine below |
| `order_lines` | creates (with the enquiry) | never | may adjust | |
| `gates` | never | never | **creates + decides** | the QC queue |
| `production_events` | never | **writes** progress | creates the stage rows; may verify | Sharik's core write |
| `approvals` | **writes the decision** | *(V1: submits)* | creates and releases | |
| `issues` | *(V1: raises)* | **raises** | **resolves** | |
| `invoices`, `payments`, `credit_notes` | never | never | **writes** | |

**The rule in one line: a row is written by exactly one app. Everyone else reads it.**

---

## THE STATE MACHINE
### `manufacturer_orders.status` — the spine of the whole system

```
  proforma_issued   ← seeded, or created by QC
        │
        ├── declined          ← MAJLIS  (client declines)   [terminal]
        ├── negotiating       ← MAJLIS  (client asks for a revision)
        │        └── back to proforma_issued
        │
        └── approved          ← MAJLIS  (client approves the proforma)
                 │
                 ▼
             in_review        ← QC  (gate opens automatically on approve)
                 │
                 ├── review_query   ← QC  (back to client)
                 ├── rejected       ← QC  [terminal, with reason]
                 │
                 └── released       ← QC  ⭐ SHARIK FIRST SEES THE ORDER HERE
                          │
                          ▼
                    in_production   ← SHARIK  (seller accepts with a date)
                          │
                          ▼
                     inspection → packed → shipped → arrived → closed   ← QC
```

**Three hard rules:**

1. **Sharik must never query an order whose status is not in** `('released','in_production','inspection','packed','shipped','arrived','closed')`. With RLS off for the demo this is enforced in the query — a plain `.inFilter('status', [...])`. A seller seeing an order while the client is still negotiating is a commercial disaster, not a bug.
2. **Majlis never writes anything except `approved`, `declined` and `negotiating`.** Every other transition belongs to QC or Sharik.
3. **Nobody skips a state.** `approved` never jumps to `released` without passing through `in_review` — that gate is the customer's own idea and the centre of the pitch.

---

## THE GATE MODEL
### `gates` is what "QC approves each step" actually means

```sql
gates(id, order_id, gate_type, status, checks jsonb, note, decided_at)
```

| `gate_type` | Opens when | QC decides | Then |
|---|---|---|---|
| `order_review` | order hits `approved` | approve / query / reject | approve → order becomes `released` |
| `sample_release` | seller submits a sample | approve / reject | approve → the approval becomes visible to the client |
| `stage_verify` | seller completes a flagged stage | approve / query | approve → stage counts as verified |
| `dispatch` | all stages complete | approve / hold | approve → order becomes `shipped` |

`status` is `pending` · `approved` · `query` · `rejected`.

**For tomorrow, only `order_review` needs to work.** The other three can exist as rows so the queue looks populated.

---

## PRODUCTION EVENTS
### The one table Sharik really owns

Stage rows are **created up front** (by QC, or by the seed) when an order is released — one row per stage, all `pending`. Sharik never inserts, only updates.

```sql
production_events(id, order_id, stage, stage_ar, sort, status,
                  qty_in, qty_out, photo_colours text[], completed_at, expected_at)
```

**Sharik's write, and this is the whole demo moment:**

```sql
update production_events
   set status = 'completed',
       qty_out = :qty,
       photo_colours = :colours,
       completed_at = now()
 where id = :id;
```

Majlis is subscribed to this table for its open orders. **That update is what makes the client's timeline move in front of Tayeb.**

Rules:
- Only the **lowest-`sort` stage that is not `completed`** is actionable in Sharik. No stage-picking.
- `qty_in` on a stage is the previous stage's `qty_out`. That chain is how Noor sees where pieces disappear.
- `photo_colours` is a text array of hex values for the demo. In production it becomes media asset IDs — **same column, different content**, so nothing has to be rebuilt.

---

## REALTIME SUBSCRIPTIONS
### Each app listens narrowly. Never to a whole table.

| App | Listens to | Filter | Reacts by |
|---|---|---|---|
| **Majlis** | `manufacturer_orders` | `client_id = me` | refetching orders |
| **Majlis** | `production_events` | order in my open orders | refetching the timeline ⭐ |
| **Majlis** | `approvals` | order in my orders, `status = pending` | showing an action card |
| **Sharik** | `manufacturer_orders` | `house_id = me` AND status in the released set | a new order card + sound ⭐ |
| **QC** | `gates` | `status = pending` | the queue badge ⭐ |
| **QC** | `manufacturer_orders` | all | the live board |

The three starred subscriptions are the demo. Wire those first, prove them, then add the rest.

---

## THE WIRING TEST
### Run this before you sleep. If it passes, the demo works.

With all three surfaces open side by side:

| # | Do this | Expect, within 2 seconds |
|---|---|---|
| 1 | Majlis: send a basket spanning 2 houses | 2 rows in `manufacturer_orders`, status `proforma_issued` |
| 2 | Majlis: approve proforma A | status → `approved`, **one `gates` row appears with `gate_type='order_review'`** |
| 3 | QC: the gate queue badge increments **on its own** | no refresh needed |
| 4 | QC: open the gate, tick the checks, **Approve** | order → `released`, gate → `approved` |
| 5 | Sharik: **the order appears on its own**, with a sound | it was invisible before step 4 |
| 6 | Sharik: Accept with a date | order → `in_production` |
| 7 | Sharik: tap **Done + photo** on the current stage | that `production_events` row → `completed` |
| 8 | Majlis: **the timeline moves on its own** | the stage turns green with the colour blocks |
| 9 | Sharik: check the other house's order | **it must not be visible** — it never got released |

**Step 9 is the one people forget, and it is the one that would embarrass you if Tayeb asked.**

---

## WHAT TO DO WHEN SOMETHING IS MISSING

If an app needs a field that does not exist:

1. **Say so out loud** — do not add it quietly
2. Decide together whether it belongs in the shared schema or is a display-only computation
3. If it belongs in the schema, **one person adds it once**, and every app regenerates
4. Never fork the schema. Two schemas is the exact problem this whole product exists to solve for the customer
