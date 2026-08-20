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
(`itmzwslepexeqixuxjca`). This app creates no project, runs no migration, and
defines no table, column, enum or view. It reads and writes the schema that
already exists.

## Where the docs and the database disagree

`docs/13-integration-contract.md` was written ahead of the schema and has drifted
from it. **The database is the truth**; the code follows it, and Sharik reached
the same conclusion independently (`sharik_repository.dart:130`).

| The contract says | The schema actually has |
|---|---|
| a `gates` table with `gate_type` | `order_reviews` — same substance, **no `gate_type`** |
| `gates.status` incl. `pending` | `review_outcome` = `passed \| query \| rejected`; pending is `decided_at IS NULL` |
| `production_events.photo_colours` | no such column |
| `production_events.stage / stage_ar / sort` | a `stage_id` FK into `production_stages` |
| `order_id` | `manufacturer_order_id` |
| `order_lines` | `manufacturer_order_lines` |

### What that means for the gate queue

Every gate `order_reviews` can express is an **Order review**. The other three
gate types in the contract — sample release, stage verify, dispatch — have
nowhere to live without a schema change. The gate-type column and filter render
and are single-valued today; adding a `gate_type` column later populates them
without reshaping this code.

The contract's step 2 ("a `gates` row appears" when the client approves) has no
writer: neither Flutter app touches `order_reviews`. That matches the write map,
which gives QC *creates and decides* — so this dashboard opens the review itself
the moment it sees an order reach `approved`, and moves it to `in_review`.

### Realtime

`order_reviews` is **not** in the `supabase_realtime` publication;
`manufacturer_orders`, `production_events` and `approvals` are. It does not need
to be. What arrives from outside is the client's approval, which is a
`manufacturer_orders` UPDATE — that fires, the queue query is invalidated, the
review is opened, and the row and badge move. No publication change required.

### Approve is not atomic

PostgREST offers no cross-table transaction, and an RPC would mean creating a
function in the shared project. So `approveGate` orders its three writes so a
part-way failure is safe rather than atomic: stage rows first (invisible while
the order is unreleased), then the release, then the decision stamp. The release
is guarded on `status IN ('in_review','approved')`, so a double-click or a second
tab cannot release twice.

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

Built: the gate queue, the gate detail, the home dashboard, and the order board
with detail. Every other sidebar row is a real route rendering a §5.10 empty
state. No auth, no RLS, no multi-tenant switching, no print/export view, no
density toggle, no command palette.
