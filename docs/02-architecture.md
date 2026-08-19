# ARCHITECTURE — Flutter · Android

## The shape

**One database. Three apps. No middle tier you don't need.**

```
                    ┌──────────────────────────────────┐
                    │           SUPABASE               │
                    │  Postgres + RLS + Auth +         │
                    │  Storage + Realtime + Edge Fns   │
                    │                                  │
                    │  ONE schema — the ontology       │
                    └───┬────────────┬─────────────┬───┘
                        │            │             │
              ┌─────────▼──┐  ┌──────▼─────┐  ┌────▼────────┐
              │   MAJLIS   │  │   SHARIK   │  │ CORE +      │
              │  client    │  │  house     │  │ COMMAND     │
              │  Flutter   │  │  Flutter   │  │ web (later) │
              │  Android   │  │  Android   │  │             │
              │  ← BUILD   │  │  later     │  │  later      │
              └────────────┘  └────────────┘  └─────────────┘
```

**The QC gate is not a service.** It is `manufacturer_orders.status` moving `approved → in_review → released`, plus a row in `order_reviews`. Do not build it as a separate app, API or worker.

---

## Target and device floor

| | |
|---|---|
| Platform | **Android only.** No iOS, no web configuration in this phase |
| `minSdk` | **24** (Android 7.0) — covers the low-end devices actually in use |
| `targetSdk` | Latest stable |
| Reference device | 2 GB RAM, mid-range chipset, 720×1600. **Not a Pixel** |
| Distribution | **Direct APK for the demo.** Play Store later |
| Build | App Bundle with ABI splits for release; universal APK for demo handout |

Keep the code platform-agnostic — no `dart:io` platform branching outside a thin `platform/` layer — so iOS becomes a build-target flip rather than a rewrite. That portability is the reason we are on Flutter rather than Kotlin.

---

## Stack — and nothing else without asking

| Layer | Choice | Why |
|---|---|---|
| Framework | **Flutter 3.x / Dart 3**, sound null safety | One codebase, iOS available later |
| State | **Riverpod** (`flutter_riverpod` + `riverpod_generator`) | Compile-safe DI, testable, no BuildContext gymnastics |
| Routing | **go_router** | Declarative, deep-linkable, shell routes for the bottom nav |
| Models | **freezed** + **json_serializable** | Immutable, exhaustive `when`, generated `fromJson` |
| Backend | **supabase_flutter** | Postgres, Auth, Storage, Realtime in one client |
| Local DB | **Drift** (SQLite) | Offline outbox and read cache; typed queries |
| Secure storage | **flutter_secure_storage** | Session tokens |
| Images | **cached_network_image** | Disk cache; essential on 3G |
| QR | **mobile_scanner** | Card scanning |
| Audio | **record** + **just_audio** | Voice notes: capture and playback |
| Push | **firebase_messaging** | The one Firebase piece worth using |
| i18n | **flutter_localizations** + **intl** (ARB) | English default, Arabic complete |
| Dates | **intl** + **hijri** | Dual calendar is a core requirement |
| Prayer times | **adhan_dart** | Quiet-hours computation |
| Tests | **flutter_test**, **golden_toolkit**, **integration_test** | Unit, golden (LTR + RTL), journey |

**Not using:** any state management other than Riverpod, any HTTP client wrapping Supabase, any UI kit that imposes its own theming, WebViews for app screens.

---

## Project layout

A single Flutter workspace with shared packages, because Sharik arrives later and must reuse the models and repositories.

```
noor/
├─ supabase/
│  ├─ migrations/           001_extensions.sql … 012_views.sql
│  ├─ seed/                 seed.sql + media manifest
│  └─ functions/            redeem-invitation, submit-enquiry,
│                           decide-approval, whatsapp-inbound, signed-media
├─ packages/
│  ├─ noor_models/          freezed models + enums, generated from the schema
│  ├─ noor_data/            Supabase repositories, Drift cache, the outbox
│  ├─ noor_core/            pure domain logic — pricing, ratio maths,
│  │                        order state machine, hijri, formatting. NO Flutter import
│  └─ noor_ui/              design system: theme, tokens, shared widgets
├─ apps/
│  ├─ majlis/               ← the only app you are building now
│  ├─ sharik/               (placeholder)
│  └─ core/                 (placeholder)
└─ noor-build/              these documents
```

Anything a second app would plausibly need goes in `packages/`, not in `apps/majlis/lib/`.

### Inside `apps/majlis/lib/`

```
lib/
├─ main.dart
├─ app.dart                 MaterialApp.router, theme, locale
├─ router.dart              go_router config, auth redirects
├─ features/
│  ├─ onboarding/           scan, pin, otp, agreement, limit
│  ├─ home/
│  ├─ houses/
│  ├─ catalogue/            styles list + style detail
│  ├─ basket/
│  ├─ orders/               list, proformas, timeline, review gate
│  ├─ approvals/
│  ├─ ledger/
│  ├─ talk/
│  ├─ inquire/              the global sheet
│  └─ settings/
└─ shared/                  app-specific widgets and helpers
```

Each feature folder holds `presentation/` (widgets and screens), `application/` (Riverpod providers, controllers) and — only if it needs its own — `data/`. Repositories that touch Supabase live in `packages/noor_data`, never in a feature.

---

## Layering rule

```
Widget  →  Riverpod provider  →  Repository  →  Supabase / Drift
```

- **Never call `Supabase.instance` from a widget.** Ever.
- **Never use `setState` for server data.** `setState` is for ephemeral widget-local UI only — an expanded/collapsed tile, a text field's focus.
- Repositories return domain models from `noor_models`, never raw `Map<String, dynamic>`.
- `noor_core` has no Flutter import and is unit-tested in isolation.

---

## The order state machine — put it in `noor_core`

```
quoting
  → proforma_issued
      → approved        (client)
      → negotiating     (client asks for revision) → back to proforma_issued
      → declined        (terminal)
  → in_review           (Noor: the GATE)
      → review_query    (back to client as an inquiry) → in_review
      → rejected        (terminal, with reason)
      → released
          → in_production
              → inspection
                  → packed → shipped → arrived → closed
```

Every transition is a function returning the new status or throwing. **No widget sets a status directly.** Every transition writes an `events` row.

---

## Environment

Use `--dart-define` (never a committed `.env`):

```
SUPABASE_URL=
SUPABASE_ANON_KEY=
TENANT_SLUG=noor
DEMO_MODE=true            # fixed OTP 000000, no SMS. MUST be false in production.
DEFAULT_LOCALE=en
```

The service-role key never leaves the edge functions. Read defines through a single `Env` class so nothing scatters `String.fromEnvironment` through the codebase.

---

## Edge functions (the only server code)

| Function | Why it can't be a direct query |
|---|---|
| `redeem-invitation` | Verifies code + PIN hash before any OTP is sent; rate-limits attempts |
| `submit-enquiry` | Splits a basket into one `manufacturer_orders` row per house atomically; enforces the sub-account limit |
| `decide-approval` | Writes the immutable signature; must be server-timestamped |
| `whatsapp-inbound` | Webhook; matches sender to client/house and attaches to the right thread |
| `signed-media` | Issues short-lived signed URLs after checking the caller may see that asset |

Everything else is a direct Supabase query protected by RLS.

---

## Performance budget — requirements, not aspirations

Measured on the reference device, release build:

| Metric | Budget |
|---|---|
| Cold start to first meaningful frame | **< 2.5 s** |
| Release APK, per-ABI split | **< 25 MB** |
| Catalogue scroll | **no frame over 16 ms** |
| Memory, steady state | < 180 MB |
| Catalogue image payload | < 60 KB each (Supabase transforms, WebP) |

Practical consequences: `const` constructors everywhere possible · `ListView.builder` never a `Column` in a `SingleChildScrollView` for long lists · `cacheExtent` tuned rather than default · `RepaintBoundary` around the timeline photo strips · images requested at display size, never full resolution · defer `firebase_messaging` init until after first frame.

---

## Realtime

Subscribe narrowly. Never to a whole table.

- `manufacturer_orders` filtered to this client's active orders
- `production_events` for open orders — the live timeline
- `approvals` where status is pending — action cards
- `messages` for the open thread only

Realtime **invalidates a Riverpod provider**; it does not write into state directly. Cancel subscriptions in `ref.onDispose`. On Android, drop all subscriptions when the app backgrounds and re-establish on resume — a socket held open in the background drains battery and will be noticed.

---

## Definition of the seam with Sharik and Core

You are building only Majlis. But every table, enum, function and policy you write is the shared one, and every model in `noor_models` is written for all three apps. When Sharik arrives it adds **no new core tables** — only UI and possibly `house_*` config. If you find yourself designing a table Majlis alone needs, check `03-data-model.md` first: the concept almost certainly already exists under a shared name.
