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

## Hosted

| | |
|---|---|
| Production | https://noor-core.vercel.app |
| Project | `noor-core` on the `yashtoops-projects` team |
| Production branch | `claude/noor-core-qc-dashboard-4lfzne` (the repo's default branch) |

Vercel builds from git, so a push to that branch redeploys. Build-time config
comes from the committed `.env.production`; to move it into Vercel's own
environment variables instead, add `NEXT_PUBLIC_SUPABASE_URL` and
`NEXT_PUBLIC_SUPABASE_ANON_KEY` under Project → Settings → Environment
Variables, delete the file, and redeploy. Both are `NEXT_PUBLIC_`, so either way
they are inlined into the client bundle and readable by anyone who loads the
page — that is inherent to a browser-only Supabase client, not a property of
where the values are stored.

### Protection, and what this plan allows

Current state: **production is public; preview deployments require a Vercel
login.** That split is not a choice, it is the plan — the Vercel account is on
Hobby, where:

- password protection needs the paid Advanced Deployment Protection add-on
  (`428 invalid_password_protection`)
- Vercel Authentication is refused for production (`428 invalid_sso_protection`)
  but works for previews, and is now enabled there

So the production URL cannot be locked from this account as it stands. Three
ways to close it, in ascending cost:

1. **Demo off a preview URL.** In Settings → Git, set the production branch to
   something this repo does not push to (e.g. `main`). Pushes to
   `claude/noor-core-qc-dashboard-4lfzne` then build as previews, which the
   Vercel Authentication above already protects — the demo laptop just needs to
   be signed into the Vercel account.
2. **Pause the project between demos.** A paused project returns 503 until
   unpaused. Free, instant, and reversible; it shrinks the exposure window to
   the times you are actually presenting.
3. **Upgrade to Pro** and turn on password protection for all deployments.

What is exposed while it is public: this build has no login by design (build
prompt Part F) and RLS is off on the shared project, so anyone with the URL can
read every client, order and price in the demo database and can release orders,
decide gates and resolve issues. The anon key is already public in this repo and
inside the Flutter APKs, so the URL does not create that exposure — it makes it
convenient.

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

## Partner search and the 360 profiles

One box in the sidebar finds a client or a house by **name, code, record id,
city, or phone**, and every result says *which* field it matched — a search
spanning six fields is unreadable otherwise. `/search` is the full results page;
`/clients` and `/houses` are searchable lists over the same matcher.

`/clients/[id]` and `/houses/[id]` are the histories: Overview, Orders,
Finance (clients) or Quality (houses), and Activity.

Three things about this schema shape what those pages can honestly show:

**Phone lives on `app_users`.** Neither `clients` nor `houses` has a phone
column; contacts hang off them by `client_id` / `house_id`. So a phone search
matches a contact and resolves to the party, and the hit names the contact. A
party with no linked contact cannot be found by phone — today that is every
house, since only the client has a contact row.

**There is no house-side finance.** `invoices`, `payments`, `credit_notes` and
`ledger_entries` are keyed by `client_id` only — nothing records what Noor owes
a house. The house profile reports *order value booked*, which is real, and says
plainly that payables are not recorded rather than showing an empty card.

**The audit log is empty.** `events(entity_type, entity_id, action, …)` exists
and nothing writes to it. So the Activity rail is reconstructed from the
timestamps the system actually keeps — orders raised, stages completed, issues
raised and resolved, invoices, payments, credit notes — with real `events` rows
merged in if anything ever starts writing them. Each line carries a chip naming
the subsystem it came from, so nothing reads as a log entry that does not exist.

Search runs in the browser over the cached party list, which is right at four
houses and one client. At thousands of partners it wants to become a Postgres
`ilike`/trigram query behind a debounce; `SearchHit` would not change shape.

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
lib/search.ts            partner matching across name/code/id/city/phone
lib/profile.ts           balances, delivery record, order book, activity rail
lib/metrics.ts           KPI derivation, point-in-time from real timestamps
lib/realtime.ts          subscriptions; invalidation, never local-state writes
```

## Scope

**Every sidebar row is now a real page.** Gate queue and gate detail, home,
orders, issues, samples, enquiries, production, clients, houses, invoices,
payments, masters, users, and search.

What each one writes is decided by the contract's write map, not by what would
be convenient:

| Page | Writes |
|---|---|
| Gate queue / detail | opens and decides all four gates; releases and ships orders |
| Issues | walks the `issue_status` ladder — the resolve verb |
| Samples | raises a sample gate; the gate itself moves the approval |
| Invoices, Payments | invoices, credit notes, payments — **and their ledger rows** |
| Orders, Production, Enquiries, Clients, Houses, Masters, Users | read-only |

Enquiries are read-only because Majlis owns them. Masters is read-only because
the stage ladder and issue types are shared with the other two apps, and
renaming a stage here would silently change what they display. Users is
read-only because there is no auth to enforce a role against — the page says so
rather than implying a permission model that nothing checks.

Still out of scope: auth, RLS, multi-tenant switching, print/export views, the
density toggle, and the command palette.

## Invoices

A basket spanning four manufacturers is already four `manufacturer_orders`, so
four invoices falls out of the existing shape — nothing was invented for it.

- `/invoices` opens on **By enquiry**: one row per enquiry, with how many
  manufacturers it covers and how many invoices await approval.
- `/invoices/batch/[enquiryId]` is the batch — every invoice for that enquiry,
  **Download all**, and **Approve & send**.
- `/invoices/order/[orderId]` is one manufacturer's invoice on its own.

Each sheet carries what the customer asked for: their name, the manufacturer's
name, and per line the item, colour, quantity, rate and **picture**.

**Download** is the browser's own print-to-PDF — no PDF library, no server
render. The `@media print` block in `app/components.css` hides everything
outside `.print-region`, forces A4, breaks one manufacturer per page, and keeps
background colours so the pictures and swatches survive. §7.6's print rules:
210mm sheet, no canvas, no shadows.

**Approve & send does not invent a second approval.** It decides each order's
existing `order_review` gate, which is the write that moves the order to
`released` — the exact moment Sharik can see it. One button, four gates, the
same state machine as the queue. Orders still being quoted or negotiated have
not reached a gate; the batch lists them as blocked and sends the rest.

### The picture

There are **no photographs in the database**. Every `media_assets.url` is the
literal `noor://gradient`, which is this platform's convention for "render
`meta.gradient` instead of loading a file" — Majlis does exactly that in its
`GradientBlock`. `pictureFor` in `lib/invoice.ts` resolves in the same order
Majlis does:

1. a real image, when `url` is an `http(s)` URL
2. the style's two-stop gradient from `meta.gradient`
3. the colourway's own `hex`
4. a neutral well, so the cell never collapses

Put a real URL into `media_assets.url` and the photograph renders with no code
change. Until then the invoice shows the same block the client saw when they
ordered, which is the honest answer rather than a broken image icon.

### Invoice totals are computed, not copied

An invoice must foot, so every amount is `pcs × unit_price`. Where the stored
`line_total` or `manufacturer_orders.subtotal` disagrees, the document prints
both and names the difference instead of silently choosing one.

That is not hypothetical: on enquiry **NT-2026-0184** — the four-manufacturer
one — `unit_price` was converted to INR but `line_total` and `subtotal` were
not, so the lines come to ₹4,13,250 while the order stores ₹4,872. The five
older orders foot correctly. Fixing those four orders' stored totals clears the
warning.

### Ledger integrity

`information_schema.triggers` is empty for `public` — nothing projects a
document into `ledger_entries` automatically, the seed wrote both by hand. So
recording an invoice, payment or credit note writes the document **and** its
ledger row, or the client's balance card and ledger tab would drift apart. The
document lands first: a document with no ledger row is visible and
reconcilable, while a ledger row pointing at a document that does not exist is
a phantom balance.

### The demo data is mid-currency-conversion

Most money is now INR — the tenant default — but a few rows are still USD:
order `NT-2026-0171-A` and its two lines, style `J-2204`, and one `price_lists`
row. Any total across them adds two different units, so the pages that sum
money show a notice when they see more than one currency. Display currency
comes from `tenants.default_currency`, never from whichever row sorted first.
Finishing the conversion on those four rows makes the notice disappear.

### Issues

This dashboard's only verb on `issues` is **resolve**, so the page walks them
along the `issue_status` ladder — open → investigating → proposed → approved →
resolved, with rejection available until the end — and records what the fix
cost. Every write is guarded on the status the operator was looking at, so two
people working the same list cannot double-advance a row.

`client_visible` is shown on every row and never editable here. Whoever raises
an issue decides whether the client sees it; changing that from the resolver's
chair would rewrite what the client was told.

`issues.sla_due_at` is null on the seeded rows, but `issue_types.sla_hours` is
populated — so the deadline is derived from the type and the moment the issue
was raised, preferring the stored value when there is one. That is a
display-only computation, not a column anyone needs to add.

**Two things to know before demoing this page.** `issues` is not in the
`supabase_realtime` publication, so unlike the gate queue it does not update on
its own — a problem raised on the seller's phone appears on the next refetch,
not within two seconds. And the seed holds exactly one issue, already resolved,
so the page opens empty under its default "Open issues" filter.
