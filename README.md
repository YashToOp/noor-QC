# Noor Core

The operations dashboard — the third surface of the Noor platform, alongside the
**Majlis** (client) and **Sharik** (manufacturer) Flutter apps. This is where
every step of every order is approved.

## Running it

```bash
npm install
npm run dev          # http://localhost:3000
```

`.env.local` is committed with the demo project's credentials, copied verbatim
from the Majlis build's `lib/config.dart`. RLS is off in that project by
deliberate demo scope, so the anon key reads everything — see
`docs/04-security-rls.md` in the build pack for the production security model.
**Do not reuse this pattern for a project holding real client records.**

## Rule Zero

All three surfaces use one Supabase project: `noor-demo`
(`itmzwslepexeqixuxjca`). This app creates no project and defines no table or
view. It has applied exactly one migration — the `gate_type` column, on the
owner's explicit instruction — which is documented in full below. Everything
else reads and writes the schema that already existed.

## Where the docs and the database disagree

`docs/13-integration-contract.md` was written ahead of the schema and has drifted
from it. **The database is the truth**; the code follows it, and Sharik reached
the same conclusion independently (`sharik_repository.dart:130`).

| The contract says | The schema actually has |
|---|---|
| a `gates` table | `order_reviews` — same substance, and now the same `gate_type` |
| `gates.status` incl. `pending` | `review_outcome` = `passed \| query \| rejected`; pending is `decided_at IS NULL` |
| `production_events.photo_colours` | no such column |
| `production_events.stage / stage_ar / sort` | a `stage_id` FK into `production_stages` |
| `order_id` | `manufacturer_order_id` |
| `order_lines` | `manufacturer_order_lines` |

## The one schema change this app made

Everything else here reads and writes what already existed. One migration was
applied, on the owner's explicit instruction, to close the largest gap:

```
migration: add_gate_type_to_order_reviews

create type gate_type as enum
  ('order_review','sample_release','stage_verify','dispatch');

alter table order_reviews
  add column gate_type gate_type not null default 'order_review';

create unique index order_reviews_one_open_gate_per_type
  on order_reviews (manufacturer_order_id, gate_type)
  where decided_at is null;
```

Neither Flutter app reads `order_reviews`, so nothing downstream had to change.
The table had no rows, so the default backfilled cleanly.

**Why the index.** A gate has no subject column — neither does the contract's
own `gates` table. It is bound to an *order*, and the subject is derived: the
stage in flight, the sample awaiting release. That is only unambiguous while an
order holds at most one **open** gate of each type, so the database enforces it
rather than trusting the application. Decided gates are excluded, so the same
gate can be raised again later. Verified against the live database: a duplicate
open gate is refused, a different type on the same order is allowed, and a type
can be re-raised once its predecessor is decided.

### How each gate opens and what approving it does

| Gate | Opens when | Approving |
|---|---|---|
| `order_review` | the order reaches `approved` | order → `released`, stage rows created |
| `stage_verify` | a stage flagged `requires_media` is completed after the last stage-gate decision | the decided gate row *is* the verification record |
| `dispatch` | every stage is complete and the order has not shipped | order → `shipped` |
| `sample_release` | **raised by hand** — see below | the approval → `pending`, which is what puts it on the client's phone |

Three of the four open themselves; `deriveOpenableGates` in `lib/gates.ts` can
see their triggers in the data. `sample_release` cannot: its trigger is "the
seller submits a sample", Sharik does not submit samples in V1, and
`approval_status` has no *awaiting QC release* member to represent one. So it is
raised from the queue toolbar until that write exists — the gate itself is fully
implemented either way.

Refusing a gate is equally real: querying a stage sends it back to
`in_progress` so the house must redo it, and rejecting a sample sets the
approval to `revision_requested` rather than showing it to the client.

### Who opens the gate

The contract's step 2 ("a gate row appears" when the client approves) has no
writer: neither Flutter app touches `order_reviews`. That matches the write map,
which gives QC *creates and decides* — so this dashboard opens the gate itself
the moment the data calls for one.

### Realtime

`order_reviews` is **not** in the `supabase_realtime` publication;
`manufacturer_orders`, `production_events` and `approvals` are. It does not need
to be, because every gate trigger lives in a table that *is* published:

- the client approving a proforma is a `manufacturer_orders` UPDATE → an
  order-review gate
- the house finishing a stage is a `production_events` UPDATE → a stage-verify
  gate, and a dispatch gate once the last one lands

Each fires, the queue query is invalidated and re-derives, the gate row is
written, and the row and sidebar badge move. No publication change required.

### Deciding a gate is not atomic

PostgREST offers no cross-table transaction, and an RPC would mean creating a
function in the shared project. So `decideGate` orders its writes so a part-way
failure is safe rather than atomic: the operational effect lands first, guarded
so it cannot fire twice, and the decision is stamped after. Releasing an order
is guarded on `status IN ('in_review','approved')` and shipping on the order not
having shipped already, so a double-click or a second tab cannot fire either
twice.

## Layout of the code

```
app/globals.css          DESIGN_SYSTEM.md §3.1, verbatim
tailwind.config.ts       DESIGN_SYSTEM.md §3.2, verbatim
app/components.css       the §5.10 shimmer keyframes, kept out of the locked files
app/(dashboard)/         the shell (§4.1) and the screens
components/ui/           §5 primitives + the §7.6 approval stepper
components/charts/       §6 charts
components/shell/        sidebar, page header, scope bar
lib/gates.ts             the gate model and its writes — read this first
lib/metrics.ts           KPI derivation, point-in-time from real timestamps
lib/realtime.ts          subscriptions; invalidation, never local-state writes
```

## Scope

Built: the gate queue carrying all four gate types, the gate detail, the home
dashboard, and the order board with detail. Every other sidebar row is a real
route rendering a §5.10 empty state. No auth, no RLS, no multi-tenant switching,
no print/export view, no density toggle, no command palette.
