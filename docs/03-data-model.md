# DATA MODEL — the shared ontology
### One Postgres schema. Three apps read and write it. This file is the source of truth.

Write these as ordered migrations under `supabase/migrations/`. Filenames suggested per section.

**Rules that apply to every table below:**
- `id uuid primary key default gen_random_uuid()`
- `tenant_id uuid not null references tenants(id)` on every domain table
- `created_at timestamptz not null default now()`, `updated_at timestamptz not null default now()`
- RLS **enabled** on every table (policies in `04-security-rls.md`)
- Bilingual text fields come in pairs: `name`, `name_ar`
- Money is `numeric(14,2)` plus a `currency char(3)`. **Never floats.**
- Quantities of garments are **pieces (integer)** and **packs (integer)**. Never fractional.

---

## 001 — Extensions and enums

```sql
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";

create type user_role       as enum ('owner','staff','client_principal','client_buyer','client_accountant','house_user');
create type party_status     as enum ('active','paused','archived');
create type invitation_status as enum ('issued','redeemed','expired','revoked');
create type limit_status     as enum ('declared','confirmed','exhausted','archived');
create type enquiry_status   as enum ('draft','submitted','quoting','quoted','closed');
create type mo_status        as enum ('quoting','proforma_issued','negotiating','approved','declined',
                                      'in_review','review_query','released','in_production',
                                      'inspection','packed','shipped','arrived','closed','cancelled');
create type review_outcome   as enum ('passed','query','rejected');
create type approval_type    as enum ('lab_dip','pp_sample','size_set','inspection','artwork');
create type approval_status  as enum ('pending','approved','revision_requested','conditional','superseded','expired');
create type stage_status     as enum ('pending','in_progress','completed','blocked','skipped');
create type issue_status     as enum ('open','investigating','proposed','approved','resolved','rejected');
create type inquiry_status   as enum ('sent','seen','answered','closed');
create type message_kind     as enum ('text','voice','photo','document','system');
create type message_source   as enum ('app','whatsapp','email','phone_note');
create type ledger_kind      as enum ('invoice','payment','credit_note','adjustment');
create type media_kind       as enum ('flat','drape','detail','roll','floor','evidence','swatch','document','avatar');
```

---

## 002 — Tenancy and identity

```sql
create table tenants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  name_ar text,
  branding jsonb not null default '{}'::jsonb,   -- logo_url, primary, accent, app_name
  default_locale text not null default 'ar',
  default_currency char(3) not null default 'USD',
  timezone text not null default 'Asia/Aden',
  created_at timestamptz not null default now()
);

-- one row per authenticated person, in any of the three apps
create table app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  tenant_id uuid not null references tenants(id),
  role user_role not null,
  client_id uuid,                    -- set for client_* roles
  house_id uuid,                     -- set for house_user
  display_name text not null,
  display_name_ar text,
  phone text,
  locale text not null default 'ar',
  order_value_limit numeric(14,2),   -- for client_buyer sub-accounts; null = unlimited
  status party_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on app_users (tenant_id, client_id);
create index on app_users (tenant_id, house_id);
```

---

## 003 — Parties

```sql
create table clients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  code text not null,
  name text not null,
  name_ar text,
  country text, city text,
  currency char(3) not null default 'USD',
  locale text not null default 'ar',
  uom_preference text not null default 'pcs',
  show_human_models boolean not null default false,   -- modesty default: OFF
  relationship_manager_id uuid references app_users(id),
  status party_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, code)
);

create table houses (                       -- manufacturers. "Noor-verified houses"
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  code text not null,
  name text not null,
  name_ar text,
  city text, country text,
  established_year int,
  worker_count int,
  specialities text[] not null default '{}',
  photo_url text,
  contact_hidden boolean not null default true,  -- never expose contact details to clients
  status party_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);

-- Noor's OWN record of a house. Belongs to Noor, not the house.
create table house_scores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  house_id uuid not null references houses(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  on_time_pct numeric(5,2),
  defect_pct numeric(5,2),
  avg_approval_turnaround_hours numeric(8,2),
  claims_count int not null default 0,
  orders_count int not null default 0,
  computed_at timestamptz not null default now()
);
create index on house_scores (house_id, period_end desc);
```

---

## 004 — Catalogue (garment-first, fabric-capable)

```sql
create table categories (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  code text not null, name text not null, name_ar text,
  sort int not null default 0,
  unique (tenant_id, code)
);

create table size_curves (                      -- configurable per tenant
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name text not null,                            -- 'Ladies S-XL'
  sizes jsonb not null,                          -- [{"size":"S","waist":66,"length":92}, ...]
  created_at timestamptz not null default now()
);

create table styles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  house_id uuid not null references houses(id),
  category_id uuid references categories(id),
  code text not null,                            -- 'D-4471'
  name text not null, name_ar text,
  fabric text, composition text, gsm int, lining text, care text,
  size_curve_id uuid references size_curves(id),
  base_price numeric(14,2) not null,             -- per piece, list
  currency char(3) not null default 'USD',
  moq_packs int not null default 0,              -- per colour
  lead_time_days int not null default 28,
  ready_stock_pcs int not null default 0,
  status party_status not null default 'active',
  created_at timestamptz not null default now(),
  unique (tenant_id, code)
);
create index on styles (tenant_id, house_id);
create index on styles using gin (name gin_trgm_ops);

create table colourways (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  style_id uuid not null references styles(id) on delete cascade,
  name text not null, name_ar text,
  hex text,
  swatch_url text,
  colour_family text,                            -- for visual filtering
  available boolean not null default true,
  moq_packs int,
  sort int not null default 0
);

create table ratio_packs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  style_id uuid not null references styles(id) on delete cascade,
  name text not null default 'Standard',
  ratio jsonb not null,                          -- {"S":2,"M":3,"L":3,"XL":2}
  pcs_per_pack int not null,                     -- must equal sum(ratio)
  is_default boolean not null default true
);

create table price_breaks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  style_id uuid not null references styles(id) on delete cascade,
  min_pcs int not null,
  price numeric(14,2) not null
);

create table media_assets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  owner_type text not null,                      -- 'style','production_event','approval','issue','house','message'
  owner_id uuid not null,
  kind media_kind not null,
  url text not null,
  thumb_url text,
  captured_at timestamptz,
  captured_by uuid references app_users(id),
  meta jsonb not null default '{}'::jsonb,       -- lighting, device, geo
  sort int not null default 0
);
create index on media_assets (owner_type, owner_id);
```

---

## 005 — Per-client assortment and pricing

```sql
-- what this client is allowed to see. Absence of a row = not visible.
create table assortments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  client_id uuid not null references clients(id) on delete cascade,
  house_id uuid references houses(id),           -- grant a whole house
  style_id uuid references styles(id),           -- or a single style
  visible boolean not null default true,
  check (house_id is not null or style_id is not null)
);
create index on assortments (client_id);

create table price_lists (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  client_id uuid not null references clients(id) on delete cascade,
  style_id uuid not null references styles(id) on delete cascade,
  price numeric(14,2) not null,
  currency char(3) not null default 'USD',
  valid_from date not null default current_date,
  valid_to date
);
create unique index on price_lists (client_id, style_id, valid_from);

-- human-authored curation. Never algorithmic output shown directly to a client.
create table selections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  client_id uuid not null references clients(id) on delete cascade,
  title text not null, title_ar text,
  note text, note_ar text,                       -- the personal sentence
  author_id uuid not null references app_users(id),
  published_at timestamptz,
  active boolean not null default true
);
create table selection_items (
  selection_id uuid not null references selections(id) on delete cascade,
  style_id uuid not null references styles(id) on delete cascade,
  sort int not null default 0,
  primary key (selection_id, style_id)
);
```

---

## 006 — Onboarding: invitation, agreement, working limit

```sql
create table invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  client_id uuid not null references clients(id),
  code text not null,                            -- goes into the QR
  pin_hash text not null,                        -- 4-digit PIN, hashed
  issued_by uuid references app_users(id),
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  redeemed_at timestamptz,
  redeemed_by uuid references app_users(id),
  attempt_count int not null default 0,
  status invitation_status not null default 'issued',
  unique (tenant_id, code)
);

create table agreement_versions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  version text not null,                         -- '2026.1'
  screens jsonb not null,                        -- [{summary, summary_ar, clause, clause_ar, audio_url, audio_url_ar}]
  effective_from date not null,
  unique (tenant_id, version)
);

create table agreement_acceptances (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  client_id uuid not null references clients(id),
  user_id uuid not null references app_users(id),
  agreement_version_id uuid not null references agreement_versions(id),
  accepted_at timestamptz not null default now(),
  ip inet, device text,
  per_screen_dwell_ms jsonb                      -- evidence of actually reading
);
-- append-only: no update or delete policy is ever granted on this table.

create table working_limits (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  client_id uuid not null references clients(id),
  season text not null,                          -- 'Ramadan 1448'
  amount numeric(14,2) not null,
  currency char(3) not null default 'USD',
  committed numeric(14,2) not null default 0,    -- drawn down on order confirmation
  declared_by uuid references app_users(id),
  confirmed_by uuid references app_users(id),
  confirmed_at timestamptz,
  status limit_status not null default 'declared'
);
-- NOTE: there is no interest, fee or penalty column here. There never will be.
```

---

## 007 — Ordering

```sql
create table baskets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  client_id uuid not null references clients(id),
  user_id uuid not null references app_users(id),
  status text not null default 'open',           -- open | submitted | abandoned
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table basket_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  basket_id uuid not null references baskets(id) on delete cascade,
  style_id uuid not null references styles(id),
  colourway_id uuid not null references colourways(id),
  ratio_pack_id uuid references ratio_packs(id),
  packs int not null check (packs > 0),
  pcs int not null,
  unit_price numeric(14,2) not null,
  note text,
  voice_note_url text
);

create table enquiries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  client_id uuid not null references clients(id),
  basket_id uuid references baskets(id),
  number text not null,
  requested_delivery_from date,
  requested_delivery_to date,
  shipping_marks text,
  consignee text,
  note text, voice_note_url text,
  status enquiry_status not null default 'submitted',
  submitted_at timestamptz not null default now(),
  unique (tenant_id, number)
);

-- ONE PER HOUSE. This is the "4 manufacturers = 4 invoices" object.
create table manufacturer_orders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  enquiry_id uuid not null references enquiries(id) on delete cascade,
  client_id uuid not null references clients(id),
  house_id uuid not null references houses(id),
  number text not null,                          -- 'NT-2026-0184-A'
  status mo_status not null default 'quoting',
  subtotal numeric(14,2), freight numeric(14,2), packing numeric(14,2),
  total numeric(14,2), currency char(3) not null default 'USD',
  lead_time_days int,
  promised_ship_date date,
  expected_arrival_date date,
  declined_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, number)
);
create index on manufacturer_orders (client_id, status);

create table manufacturer_order_lines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  manufacturer_order_id uuid not null references manufacturer_orders(id) on delete cascade,
  style_id uuid not null references styles(id),
  colourway_id uuid not null references colourways(id),
  ratio_pack_id uuid references ratio_packs(id),
  packs int not null, pcs int not null,
  unit_price numeric(14,2) not null,
  line_total numeric(14,2) not null,
  status text not null default 'pending'
);

create table proformas (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  manufacturer_order_id uuid not null references manufacturer_orders(id) on delete cascade,
  number text not null,
  total numeric(14,2) not null, currency char(3) not null default 'USD',
  valid_until date,
  issued_at timestamptz not null default now(),
  decided_at timestamptz,
  decided_by uuid references app_users(id),
  decision text,                                 -- approved | declined | revision_requested
  unique (tenant_id, number)
);

-- his "order placed -> QC -> approved -> dealer". The GATE.
create table order_reviews (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  manufacturer_order_id uuid not null references manufacturer_orders(id) on delete cascade,
  checks jsonb not null default '{}'::jsonb,     -- {specs_complete:true, ratios_feasible:true, moq_met:true,
                                                 --  price_confirmed:true, lead_time_ok:false, limit_available:true}
  outcome review_outcome,
  note text,
  reviewer_id uuid references app_users(id),
  started_at timestamptz not null default now(),
  decided_at timestamptz
);
```

---

## 008 — Production, approvals, issues

```sql
create table production_stages (                 -- CONFIGURABLE per tenant. Never hardcode.
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  code text not null, name text not null, name_ar text,
  sort int not null,
  typical_duration_days int,
  requires_media boolean not null default true,
  client_visible boolean not null default true,
  unique (tenant_id, code)
);

create table production_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  manufacturer_order_id uuid not null references manufacturer_orders(id) on delete cascade,
  stage_id uuid not null references production_stages(id),
  status stage_status not null default 'pending',
  qty_in int, qty_out int,
  expected_at date, started_at timestamptz, completed_at timestamptz,
  actor_id uuid references app_users(id),
  note text
);
create index on production_events (manufacturer_order_id, stage_id);

create table approvals (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  manufacturer_order_id uuid not null references manufacturer_orders(id) on delete cascade,
  order_line_id uuid references manufacturer_order_lines(id),
  type approval_type not null,
  title text not null, title_ar text,
  swatch_ref text,                               -- physical swatch couriered to the client
  lighting text,                                 -- 'D65 standardised'
  compare_to_approval_id uuid references approvals(id),   -- last approved standard
  due_at timestamptz,
  status approval_status not null default 'pending',
  decision text,                                 -- approve | revise | conditional
  condition_text text,
  reason text, reason_voice_url text,
  decided_by uuid references app_users(id),
  decided_at timestamptz,
  signature jsonb                                -- {user_id, at, device, ip} — immutable once set
);

create table issue_types (                       -- CONFIGURABLE. shade_variance, short_qty, delay, ...
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  category text not null,                        -- colour | fabric | quantity | print | size | time | commercial | docs
  code text not null, name text not null, name_ar text,
  sla_hours int not null default 24,
  default_client_visible boolean not null default false,
  unique (tenant_id, code)
);

create table issues (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  issue_type_id uuid not null references issue_types(id),
  manufacturer_order_id uuid references manufacturer_orders(id) on delete cascade,
  order_line_id uuid references manufacturer_order_lines(id),
  house_id uuid references houses(id),
  client_id uuid references clients(id),
  raised_by uuid references app_users(id),
  raised_at timestamptz not null default now(),
  description text,
  status issue_status not null default 'open',
  sla_due_at timestamptz,
  resolution text,                               -- rework | replace | price_adjust | partial | reject | waiver
  cost_impact numeric(14,2), days_impact int,
  approver_id uuid references app_users(id),
  resolved_at timestamptz,
  client_visible boolean not null default false  -- internal house disputes stay internal
);
create index on issues (manufacturer_order_id, status);
```

---

## 009 — Inquiries, threads, messages

```sql
create table inquiries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  client_id uuid not null references clients(id),
  user_id uuid not null references app_users(id),
  context_type text not null,   -- style|colourway|house|basket_line|proforma|order|stage|invoice|ledger_entry|approval|general
  context_id uuid,
  inquiry_type text not null,   -- sizing|price|colour|availability|lead_time|quality|payment|other
  body text, voice_note_url text,
  status inquiry_status not null default 'sent',
  assignee_id uuid references app_users(id),
  sla_due_at timestamptz,
  answer text, answered_by uuid references app_users(id), answered_at timestamptz
);
create index on inquiries (client_id, status);

create table threads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  context_type text not null, context_id uuid,
  client_id uuid references clients(id),
  house_id uuid references houses(id),
  last_message_at timestamptz
);

create table messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  thread_id uuid not null references threads(id) on delete cascade,
  sender_id uuid references app_users(id),
  kind message_kind not null default 'text',
  body text,
  media_url text, duration_seconds int,
  transcript text, transcript_lang text,
  translation text, translation_lang text,
  source message_source not null default 'app',   -- 'whatsapp' for captured inbound
  external_ref text,                              -- WhatsApp message id
  created_at timestamptz not null default now()
);
create index on messages (thread_id, created_at desc);
```

---

## 010 — Money, shipping, documents

```sql
create table invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  client_id uuid not null references clients(id),
  manufacturer_order_id uuid references manufacturer_orders(id),
  number text not null,
  amount numeric(14,2) not null, currency char(3) not null default 'USD',
  issued_at date not null default current_date,
  due_at date,
  unique (tenant_id, number)
);

create table payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  client_id uuid not null references clients(id),
  amount numeric(14,2) not null, currency char(3) not null default 'USD',
  method text, reference text,
  advice_url text,
  received_at date not null default current_date
);

create table credit_notes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  client_id uuid not null references clients(id),
  manufacturer_order_id uuid references manufacturer_orders(id),
  issue_id uuid references issues(id),            -- every deduction carries its reason
  number text not null,
  amount numeric(14,2) not null, currency char(3) not null default 'USD',
  reason text not null,
  issued_at date not null default current_date,
  unique (tenant_id, number)
);

-- the client's statement is a view over these
create table ledger_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  client_id uuid not null references clients(id),
  kind ledger_kind not null,
  ref_type text not null, ref_id uuid not null,
  amount numeric(14,2) not null,                  -- positive = owed by client, negative = credit
  currency char(3) not null default 'USD',
  occurred_at date not null,
  description text, description_ar text
);
create index on ledger_entries (client_id, occurred_at desc);

create table shipments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  container_no text, carrier text,
  etd date, eta date,
  port_of_loading text, port_of_discharge text,
  status text not null default 'planned'
);
create table shipment_orders (
  shipment_id uuid references shipments(id) on delete cascade,
  manufacturer_order_id uuid references manufacturer_orders(id) on delete cascade,
  primary key (shipment_id, manufacturer_order_id)
);

create table documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  owner_type text not null, owner_id uuid not null,
  kind text not null,                             -- proforma|invoice|packing_list|coo|bl|inspection_report
  number text, url text not null,
  issued_at date,
  client_visible boolean not null default true
);

create table sample_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  client_id uuid not null references clients(id),
  style_id uuid not null references styles(id),
  colourway_id uuid references colourways(id),
  status text not null default 'requested',
  courier_ref text, swatch_ref text,
  requested_at timestamptz not null default now(), sent_at timestamptz
);
```

---

## 011 — System: event log and notifications

```sql
-- IMMUTABLE. Append only. No update or delete policy, ever.
create table events (
  id bigserial primary key,
  tenant_id uuid not null references tenants(id),
  actor_id uuid references app_users(id),
  entity_type text not null, entity_id uuid not null,
  action text not null,                           -- created|updated|approved|released|resolved|...
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index on events (entity_type, entity_id, created_at);
create index on events (tenant_id, created_at desc);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  user_id uuid not null references app_users(id),
  kind text not null,
  title text, title_ar text, body text, body_ar text,
  ref_type text, ref_id uuid,
  channels text[] not null default '{inapp}',     -- inapp|push|whatsapp|sms
  scheduled_for timestamptz,                      -- shifted out of prayer times
  sent_at timestamptz, read_at timestamptz
);
create index on notifications (user_id, read_at, created_at desc);
```

---

## 012 — Views Majlis reads

```sql
-- what a client is allowed to see, resolved
create view v_client_catalogue as
select distinct s.*, c.id as client_id,
       coalesce(pl.price, s.base_price) as client_price,
       coalesce(pl.currency, s.currency) as client_currency
from styles s
join clients c on c.tenant_id = s.tenant_id
join assortments a on a.client_id = c.id and a.visible
     and (a.style_id = s.id or a.house_id = s.house_id)
left join price_lists pl on pl.client_id = c.id and pl.style_id = s.id
     and pl.valid_from <= current_date
     and (pl.valid_to is null or pl.valid_to >= current_date)
where s.status = 'active';

create view v_client_statement as
select le.*, 
       sum(le.amount) over (partition by le.client_id order by le.occurred_at, le.id) as running_balance
from ledger_entries le;

create view v_house_current_score as
select distinct on (house_id) * from house_scores order by house_id, period_end desc;
```

---

## Integrity rules to enforce with triggers

1. `ratio_packs.pcs_per_pack` must equal the sum of `ratio` values.
2. `basket_lines.pcs` = `packs × ratio_packs.pcs_per_pack`.
3. `approvals.signature` is write-once — reject any update that changes a non-null signature.
4. `agreement_acceptances` and `events` reject UPDATE and DELETE entirely.
5. `working_limits.committed` only changes via a function called on `manufacturer_orders` reaching `released`.
6. Every insert/update on the tables above writes a row to `events`.
