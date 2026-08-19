# SEED DATA
### The demo is only as convincing as this file. Nothing here may look like test data.

**Rules:** no "Test Client", no "Lorem", no `style-1`. Real-sounding Arabic and English names, plausible prices, dates relative to `now()` so the demo never goes stale. Seed lives in `supabase/seed/seed.sql` and must be idempotent.

---

## Tenant

`noor` — Noor Traders / نور للتجارة · default locale `ar` · currency `USD` · timezone `Asia/Aden`.
Branding: deep green `#0E3B2E`, gold `#C9A227`.

## Users

| Role | Name | Notes |
|---|---|---|
| `owner` | Tayeb Abdullah / طيب عبدالله | authors the curated selections |
| `staff` | Imran Qureshi | ops, runs the review gate |
| `staff` | Fatima Al-Sayed | Arabic relationship manager |
| `client_principal` | Abu Khalid / أبو خالد | **the demo user** |
| `client_buyer` | Yasir (his nephew) | `order_value_limit = 5000` — demonstrates the approval path |
| `client_accountant` | Nabil | ledger only |
| `house_user` | Zubair | for later, when Sharik exists |

## Clients (3 — so the RLS test has something to fail against)

| Code | Name | City | Currency |
|---|---|---|---|
| `NT-001` | Abu Khalid Trading / تجارة أبو خالد | Sana'a | USD |
| `NT-002` | Al-Waseem Stores | Aden | USD |
| `NT-003` | Bin Shihab & Sons | Mukalla | USD |

Client 1 gets the full assortment. Clients 2 and 3 get a **different, overlapping** assortment and **different prices for the same styles** — this is what makes the RLS test meaningful.

## Houses (4)

| Name | City | Est. | Workers | Specialities | On-time | Defect |
|---|---|---|---|---|---|---|
| Zubair Garments / زبير للملابس | Surat | 1998 | 480 | skirts, dresses | 94% | 1.2% |
| Al-Huda Textiles / الهدى تكستايل | Surat | 2006 | 220 | abayas | 78% | 2.9% |
| Al-Noor Mills / مصنع النور | Erode | 2011 | 310 | knits, dresses | 91% | 1.6% |
| Al-Safa Garments / مصنع الصفا | Tiruppur | 2014 | 150 | scarves, sets | 86% | 2.1% |

The spread matters — Al-Huda's weaker numbers make the score column meaningful rather than decorative.

## Categories

Skirts / تنانير · Dresses / فساتين · Abayas / عبايات · Scarves / أوشحة · Sets / أطقم

## Size curves

- **Ladies S–XL** — `[{S,waist:66,length:92},{M,70,94},{L,74,96},{XL,78,98}]`
- **Ladies 36–44** — numeric, for dresses
- **Free size** — abayas and scarves

## Styles (12 minimum, 3 per house)

Anchor style — **this is the one used in every demo**:

```
code:        D-4471
name:        Linen midi skirt / تنّورة كتّان طويلة
house:       Zubair Garments
category:    Skirts
fabric:      Linen blend · 55% linen 45% viscose · 180 gsm · half lined
base_price:  2.60 USD/pc      (client NT-001 price list: 2.40)
moq_packs:   30 per colour
lead_time:   28 days
size_curve:  Ladies S–XL
ratio_pack:  {S:2, M:3, L:3, XL:2} = 10 pcs/pack
colourways:  Navy(approved Mar 2025) · Black · Maroon · Sand · Emerald · Rose · Grey
price_breaks: 300pcs→2.40 · 1000pcs→2.30 · 3000pcs→2.20
```

Others should vary meaningfully: an abaya at $5.80 with a free-size curve, an evening dress at $5.10 on the 36–44 curve, a scarf at $0.90 with a 100-pack MOQ, two styles with `ready_stock_pcs > 0`, one style `available=false` on two colourways to exercise the out-of-stock state.

## Media

Colour-block placeholders generated at seed time and uploaded to `style-media` — the same gradient treatment as the prototypes. **Do not use stock photography of models**; it violates the modesty default and a prospect will spot generic imagery instantly. Every style needs ≥4 assets: flat, mannequin, detail, and one drape video placeholder.

## Curated selection

One active `selection` for Abu Khalid, authored by **Tayeb**, published 7 days ago:

> **ar:** «أبو خالد، هذا الكحلي أقرب للون الذي أعجبك في مارس. الدفعة السابقة مالت للأحمر قليلاً.»
> **en:** "Abu Khalid, this navy is closer to the one you liked in March. The last lot ran slightly red."

Items: D-4471 (Navy) and the evening dress.

## Working limit

`Ramadan 1448` · `640,000 USD` · `committed 412,000` · status `confirmed`.
Plus a **previous season row** so the onboarding screen has something to pre-fill from.

## Invitations

Three `issued` invitations with known codes for the demo, PIN `4718` (hashed):
`NOOR-AK-2026` (Abu Khalid) · `NOOR-AW-2026` · `NOOR-BS-2026`.
Plus one `redeemed` and one `expired`, so those states are demonstrable.

## Agreement

Version `2026.1`, 4 screens, both languages, with the exact summaries from the prototype:

1. How we work together — Noor's role, disclosed cost-plus margin, responsibilities
2. Orders, prices, quantities — 14-day price validity, **±3% quantity tolerance**, MOQ per colour
3. Quality, sizes and claims — inspection standard, measurement and shade tolerance, claim window, remedies
4. Payment, limits and delivery — terms, working limit, Incoterms, **no interest or penalty ever**

Seed an `agreement_acceptances` row for Abu Khalid so returning to the demo skips onboarding, and leave clients 2 and 3 unaccepted so the flow can be demonstrated fresh.

## The three orders — the heart of the demo

**Order A · `NT-2026-0184` · Zubair Garments · $48,200 · status `in_production`**
The hero. Stages seeded so that:
`proforma approved` → `order review passed` → `released` → `PP sample approved (4 photos)` → `cutting complete (qty_in 8400, qty_out 8400, 2 photos)` → **`stitching in progress, 5208/8400, 4 photos`** → remaining stages pending with expected dates.
ETA ~40 days out, container `MSKU-4471xx`, ETA rendered in both calendars.

**Order B · `NT-2026-0184-B` · Al-Huda · $1,100 · status `negotiating`**
Proforma issued, client requested a price review. One open `inquiry` attached.

**Order C · `NT-2026-0184-C` · Al-Noor Mills · $1,410 · status `in_review`**
Sitting in the Order Review Gate with `checks` = all true except `lead_time_ok`, so the gate screen shows five ticks and one pending.

**Order D · `NT-2026-0184-D` · Al-Safa · status `declined`**, with a reason.

Together these four render the "four proformas, four states" screen exactly as designed.

Also seed **one completed order from last season** (`closed`, arrived, invoiced, paid) so "Your repeats" and one-tap reorder have real history.

## Approvals

- **Pending, due in 7 days:** lab dip for D-4471 Navy, swatch ref `SW-8841`, lighting `D65 standardised`, `compare_to_approval_id` → last season's approved navy. This drives the Home action card.
- **Approved, last season:** the navy standard being compared against — with a signature block.
- One `revision_requested` with a reason, to show the state.

## Issues

- One `client_visible` issue on Order A: minor shade variance, resolved with a price adjustment, cost impact recorded, evidence photos attached.
- One **internal** issue (`client_visible = false`) with Al-Huda about delivery. **The demo must show this never appears in Majlis** — that is a feature worth pointing at.

## Ledger

Balance `$18,420`. Aging: `$12,300` within 30 days, `$6,120` at 30–60, **`$0` overdue**.
Entries: invoice `INV-0184-A $1,764` · payment `−$9,000` by TT · credit note `CN-0179 −$310` with reason "40 pieces short in the lot" and a linked issue and evidence photos.

## Threads and messages

One thread on Order A, stage `stitching`:
1. Client, text, ar: "The navy in the photos looks a little darker than the swatch. Is it the same?"
2. Tayeb, **voice note 0:14**, with transcript and English translation:
   "Exactly the same colour, Abu Khalid — that photo is under factory light. We'll send you one under standard lighting today."
3. One message with `source = 'whatsapp'` so the "arrived via WhatsApp" marker is visible.

## Inquiries

One `answered` (sizing question on D-4471) and one `sent` and still open, so both states render.

## Notifications

Three unread: proforma ready, approval due, stage completed. All with `scheduled_for` already shifted out of Sana'a prayer times, so the mechanism is inspectable.

---

## Seed check

After `supabase db reset && supabase db seed`, signing in as Abu Khalid must produce a Home screen with: **one action card**, a curated selection carrying Tayeb's note, four category boxes, one active order at 62% stitching with a photo thumbnail, and a limit meter at 412K/640K. If any of those is missing or empty, the seed is wrong — fix the seed, not the UI.
