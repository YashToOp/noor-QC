# PRODUCT CONTEXT
### Read this before you write code. Most of the odd-looking decisions below are deliberate.

## Who this is for

**Noor Traders** is a Yemeni garment sourcing house. ~₹50 crore a year of throughput on a **disclosed 5% cost-plus margin**, ten to fifteen client families held for twenty years, flat growth. They buy finished garments — skirts, dresses, abayas — from manufacturers in India and ship them to buyers in Yemen and the Gulf.

Three groups use the platform:

| | Who | App |
|---|---|---|
| **Clients** | Yemeni/Gulf trading families. Older principals, Arabic only, poor connectivity, deep personal relationship with the owner | **Majlis** ← you are building this |
| **Houses** | Indian manufacturers. Often semi-literate, cheap Android phones, live entirely in WhatsApp | Sharik (later) |
| **Noor** | The owner and a small ops team | Core + Command (later) |

## The problem being solved

The entire ₹50 crore business runs on WhatsApp. Purchase orders, shade approvals, defect photos, delivery promises, complaints — all in a scrolling green river with no search, no structure, no memory and no accountability. When something goes wrong six months later, the proof is in a thread on a phone that has been reset.

Measured leakage from this is roughly **₹58 lakh a year against ₹75 lakh of net profit.** They are losing most of what they earn to problems that are nobody's fault in particular.

## The nine decisions that will look wrong if you don't know why

**1. There is no sign-up, ever.**
Noor creates the account from records they already have and hands over a physical business card with a QR and a 4-digit PIN. The client's first experience is his own name already on screen. He has been a customer for twenty years; asking him to register would be insulting.

**2. There is no "Buy Now" button, and no payment gateway.**
In this trade an order is a negotiation — quantities move, prices get discussed, delivery gets agreed. The button says **"Send to Noor"** and creates an *enquiry*. Noor replies with proformas. Never build a checkout.

**3. One basket becomes several orders.**
A basket spanning four manufacturers produces **four proformas**, which the client approves, negotiates or declines **independently**. Nothing waits on anything. This is the single most important structural behaviour in the app.

**4. Two different things are both called "QC".**
The **Order Review Gate** checks the *order* before it reaches a factory (specs complete, ratios feasible, MOQ met, price confirmed, lead time achievable, limit available). **Quality Inspection** checks the *goods* before packing (AQL, measurement, shade). Keep them distinct in code and in copy.

**5. The client watches his goods being made.**
Photos are already captured at each production stage for QC. Surfacing them to the client costs nothing and is the single strongest trust feature in the product. A client in Sana'a has never once seen his order in production.

**6. Bad news is delivered by a person, not by the app.**
When a stage slips, the system detects it and notifies **Noor first**, opening a window for a human to write an explanation. Only then does the client see the amber stage. *Machine detects, human delivers.* An app that only shows good news gets opened once and abandoned.

**7. The algorithm never speaks to the client.**
Curation on the home screen is written by a person, signed with their name and the date. Later versions may suggest items — but always to Noor's relationship manager, who edits and signs before anything reaches a client. Anything that feels machine-generated depreciates a twenty-year relationship.

**8. No interest. No late fees. No penalties. Anywhere.**
The customer's business runs on Islamic commercial principles. There is no such column in the schema and no such number in the UI. Overdue is displayed as information. This is a constraint, not a preference.

**9. Ambiguity is a defect.**
Avoiding *gharar* — contractual ambiguity — is a religious and commercial requirement. It's why the Agreement is four screens with a plain-language summary and read-aloud audio, why MOQ and tolerance are shown before ordering, and why every deduction carries its reason and its evidence.

## Cultural and practical requirements

- **Arabic-first, RTL native.** Designed in Arabic, adapted to English — not translated toward Arabic.
- **Hijri and Gregorian dates together, everywhere.** Their year runs on Ramadan and the two Eids.
- **Prayer-time-aware notifications.** No pings during Salah for the client's city; Jumu'ah respected.
- **Modesty default: no human models.** Garments shown flat, on mannequins, or as drape video. Configurable per client, defaults off.
- **Voice notes are first-class.** Their existing behaviour is WhatsApp voice notes. Absorb it; don't fight it.
- **Assume 3G and 12% battery.** Yemen has unreliable connectivity and unreliable power. If it doesn't open, nothing else matters.
- **The principal is often 55+.** Large type, high contrast, two taps and his voice for anything important.

## What this build is for

A **demonstration** convincing enough to put in front of the real customer, built on the real schema so it becomes the production system without a rewrite. Commercially it is also the **white-label base**: the same schema and UI will be resold to other trading houses, with language, branding, currency, stages and issue taxonomy as configuration. That is why nothing about Noor may be hardcoded.
