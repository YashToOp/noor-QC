# CONVENTIONS & DEFINITION OF DONE

## Code

- **Dart 3, sound null safety.** No `dynamic`. No `!` except immediately after a checked guard.
- Models are **generated** with `freezed` + `json_serializable` in `packages/noor_models`. Regenerate after every migration: `dart run build_runner build --delete-conflicting-outputs`.
- Domain logic lives in `packages/noor_core` and has **no Flutter import**. Pricing, ratio-pack expansion, order state transitions, formatting, Hijri — all pure and unit-tested.
- Widgets are dumb. Data access goes through repositories in `packages/noor_data`, exposed as Riverpod providers. **A widget that calls `Supabase.instance` is a defect.**
- **No `setState` for server data.** `setState` is for ephemeral widget-local UI only.
- `const` constructors wherever possible — a performance requirement on the reference device, not style.
- One widget per file, file named in `snake_case` after the widget.

## Naming

| Thing | Convention |
|---|---|
| DB tables and columns | `snake_case`, plural tables |
| Dart files | `snake_case.dart` |
| Classes, widgets, models | `PascalCase` |
| Variables and functions | `camelCase` |
| Providers | `catalogueProvider`, `orderRepositoryProvider` |
| ARB keys | semantic camelCase — `basketMoqShortfall` |
| Migrations | `NNN_short_description.sql`, never renumbered once merged |

## Git

```
feat(majlis): basket groups lines by house
fix(rls): houses could read price_lists
chore(db): regenerate types after 007
```

One concern per commit. Branch per phase from the build prompt. **Never commit** `.env`, service-role keys, or real client data.

## Testing

| Kind | Tool | What |
|---|---|---|
| Unit | `flutter_test` | `noor_core` — pricing, ratios, state machine, Hijri |
| **RLS** | Dart test + service-role client | The isolation matrix in `04-security-rls.md` |
| **Golden** | `golden_toolkit` | Every screen in **both** `TextDirection.ltr` and `rtl` |
| Journey | `integration_test` on a real device | The full demo journey, both locales |

The RLS suite is not optional and not deferrable. It is the one test that protects the customer's business.

## Accessibility and i18n checks

- Every screen has passing goldens in **both** `TextDirection.ltr` and `TextDirection.rtl`
- No hardcoded user-facing string outside the ARB files — enforce with a custom lint
- **No physical direction constructors** — `dart analyze` fails the build on `EdgeInsets.only(left:/right:)`, `Alignment.centerLeft/Right`, `Positioned(left:/right:)`, `TextAlign.left/right`
- Numbers, money and order codes wrapped `TextDirection.ltr`
- Contrast AA (`goldText`, never `gold`, for text); tap targets ≥ 48dp

## Performance gates (CI fails below these)

Measured on the reference device (2 GB RAM, mid-range, `minSdk 24`), release build:

- Cold start to first meaningful frame ≤ 2.5 s
- Release APK ≤ 25 MB per ABI split
- No frame over 16 ms on the catalogue scroll
- Steady-state memory ≤ 180 MB
- No catalogue image over 60 KB on the wire

---

## Definition of Done — per screen

A screen is done when **all** of these are true:

1. Goldens pass in **both** LTR and RTL, committed in the same phase
2. Has loading, loaded, **empty**, and **error/offline** states
3. Reads only from Supabase — **zero hardcoded content**
4. Respects RLS (no `client_id` filter anywhere in Dart)
5. Works offline where the spec requires it, with the outbox
6. Dates show **both calendars**; money and codes are `dir="ltr"`
7. Has an **Inquire** affordance if it is a detail screen
8. Matches the prototype visually
9. Tap targets ≥ 48dp, contrast AA, `Semantics` labels in both languages
10. `flutter analyze` clean; no unhandled exceptions; no overflow at 1.3x text scale

## Definition of Done — the build

- `supabase db reset` runs every migration and seed clean, from scratch
- `dart run build_runner build` and `flutter analyze` are clean
- The **RLS test suite passes**
- **All goldens pass in both directions**
- The **journey test passes on a real Android device, in both locales**: card → PIN → OTP → agreement → limit → home → houses → style → basket → send → four proformas → approve two → timeline → shade approval → ledger
- `flutter build apk --release` produces an installable APK within the size gate
- Performance gates met on the reference device
- `README` documents setup in under ten steps

---

## Things that mean you have gone wrong

- A table without `tenant_id`
- A table without RLS enabled
- A hardcoded stage name, issue type, house name, currency or category
- A `client_id` filter anywhere in Dart
- Any column or UI element implying interest, a late fee, or a penalty
- A "Buy Now" or "Checkout" button
- A basket that produces one order instead of one per house
- A sign-up or registration form
- A physical `EdgeInsets.only(left:)`, `Alignment.centerLeft`, or `TextAlign.left`
- `setState` holding server data, or a widget calling `Supabase.instance`
- A screen shipped without its RTL golden
- A device timestamp used as approval evidence
- Copying a shared concept into a Majlis-only table

## When the spec is silent

**Ask.** These documents are unusually detailed on purpose — where they are silent it is usually because the answer is a genuine product decision, not an oversight. A wrong guess in this domain is expensive: the customer's entire business runs on the precision of these objects.
