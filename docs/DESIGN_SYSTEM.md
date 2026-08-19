# ERP Dashboard Design System
### Reverse-engineered from the Retell AI dashboard — exact tokens, layout math, and component specs

> **What this document is.** Every value below was measured off the live Retell AI dashboard DOM (computed styles, not guesses). It is written so that a developer *or* an AI coding agent can rebuild the same visual language for a completely different product (an ERP) without ever seeing the original.
>
> **Stack this targets:** React + TypeScript + Tailwind CSS + shadcn/ui + Recharts.
>
> **Companion file:** `BUILD_PROMPT.md` — a paste-ready prompt that makes an AI agent generate screens in this exact style.

---

## Table of contents

1. [The Design DNA — 12 rules that define this style](#1-the-design-dna)
2. [Foundations](#2-foundations)
3. [Drop-in token files](#3-drop-in-token-files)
4. [Layout architecture](#4-layout-architecture)
5. [Component specifications](#5-component-specifications)
6. [Data visualization system](#6-data-visualization-system)
7. [Applying this to an ERP](#7-applying-this-to-an-erp)
8. [Accessibility](#8-accessibility)
9. [Do / Don't](#9-do--dont)
10. [QA checklist before you ship a screen](#10-qa-checklist)
11. [Appendix — complete measured token dump](#11-appendix--complete-measured-token-dump)

---

## 1. The Design DNA

If you internalise nothing else, internalise these twelve rules. They are what make the style recognisable. Everything in section 5 is just these rules applied.

**1. Two-surface architecture.** The app has exactly two background planes: a cool grey **canvas** (`#f5f5fa`) that the sidebar sits directly on, and a **white content panel** (`#ffffff`) that floats on top of it as a single large rounded rectangle. The panel is inset from the viewport by ~4px on top/right/bottom, has a 16px radius and a hairline border. Nothing else in the app gets a background colour unless it is carrying data.

**2. Hairline borders, never shadows.** Structure is communicated with `0.5px` borders in `#d5d5e8` — a cool, slightly violet grey. Cards have **`box-shadow: none`**. Shadows exist in the token set but are reserved exclusively for *floating* layers (dropdowns, popovers, modals, toasts). A card that casts a shadow is a bug.

**3. Radius ladder: 6 → 8 → 12 → 16.** 6px for tiny inline chips and tab labels, 8px for controls (buttons, inputs, nav items), 12px for inner data wells, 16px for cards and the content panel. Never 4px, never 20px, never fully-round except avatars and status dots.

**4. Ink, not black.** The darkest text is `#172131` — a desaturated navy. Pure black (`#000`) appears nowhere. Secondary text is `#606a78`, tertiary/labels `#8793a3`. The three-step text ramp does all the hierarchy work; font weight only ever goes 400 → 500.

**5. Weight 500 is the maximum.** There is no bold (600/700) anywhere in the chrome. Emphasis comes from *colour* and *size*, not weight. Page title = 20px/500. Card title = 16px/500. KPI number = 32px/500. Body/labels = 14px/400.

**6. 14px is the interface size.** Almost the entire UI is `text-sm` (14px / 20px line height). 12px is for section labels, axis ticks, legends and helper text. 16px is for card titles. 20px for page titles. 32px for hero numbers. That is the whole scale.

**7. The tinted well.** Any block that displays a *value* rather than *chrome* sits in a barely-there tinted well: `background: rgba(57, 70, 91, 0.03)` with a 12px radius. This is the single most distinctive move in the system — it is how a KPI number, a chart area, or a code block gets separated from the card without adding a border. The same colour at `0.05` alpha is the sidebar active-item fill.

**8. 32px is the control height.** Buttons, inputs, selects, nav rows and toolbar items are all exactly 32px tall with 8px horizontal padding and an 8px gap between icon and label. Icons in controls are 16px. This gives the whole app a tight, dense, "power tool" rhythm — the opposite of a consumer marketing site.

**9. Charts are monochrome-first.** A single-series chart uses one blue (`#6895FF`) with a vertical gradient fade underneath (25% → 5% alpha). The 12-colour categorical palette is only unlocked when a chart genuinely has multiple categories. Gridlines are dotted (`3 3`) in the same `#d5d5e8` border colour, horizontal only, and there is no axis line.

**10. Generous card padding, tight everything else.** Cards use `pt-16 / px-20 / pb-24` (top 16px, sides 20px, bottom 24px) and a 24px gap between title and body. Outside of cards, the spacing scale is 4/8/12/16/24.

**11. Uppercase micro-labels group the nav.** Sidebar sections are separated by 12px uppercase `#8793a3` medium labels (`DEPLOY`, `DATA`, `MONITOR`, `SYSTEM`) — not by dividers.

**12. Motion is functional and fast.** Colour transitions on hover, 300ms `ease-in-out` on the sidebar width collapse. No entrance animations, no bouncing, no parallax. Charts may animate on first mount only.

---

## 2. Foundations

### 2.1 Typography

**Family:** `Inter` with a metric-matched fallback, applied with `antialiased`.

```css
font-family: Inter, "Inter Fallback", system-ui, -apple-system, "Segoe UI", sans-serif;
-webkit-font-smoothing: antialiased;
-moz-osx-font-smoothing: grayscale;
```

Load Inter with `font-feature-settings: "cv11", "ss01"; font-variation-settings: "opsz" 32;` if you want the exact glyph shapes (single-storey `a` disambiguation used by the original). Enable **tabular numerals** on every numeric cell and KPI: `font-variant-numeric: tabular-nums;`

#### The complete measured type scale

| Role | Size | Line height | Weight | Letter-spacing | Colour | Tailwind |
|---|---|---|---|---|---|---|
| Hero / KPI value | 32px | 1.0–1.2 | 500 | **+1.92px** (`0.06em`) | `#172131` | `text-[32px] font-medium tracking-[1.92px]` |
| Page title | 20px | 28px | 500 | normal | `#172131` | `text-xl font-medium leading-7` |
| Card title | 16px | 24px | 500 | tight (`-0.011em`) | `#172131` | `text-base font-medium leading-6 tracking-tight` |
| Body / default | 16px | 24px | 400 | normal | `#0a0a0a` | `text-base` |
| **Interface default** | **14px** | **20px** | **400** | normal | `#606a78` | `text-sm leading-tight` |
| Interface emphasis | 14px | 20px | 500 | normal | `#172131` | `text-sm font-medium` |
| Tab label | 14px | 20px | 500 | `-0.084px` | `#172131` (active) / `#8793a3` (idle) | `text-sm font-medium tracking-[-0.084px]` |
| Section label (nav) | 12px | 16px | 500 | normal, **UPPERCASE** | `#8793a3` | `text-xs font-medium uppercase` |
| Chart axis tick | 12px | — | 400 | normal | `#737373` | `fontSize: 12, fill: '#737373'` |
| Chart legend | 12px | — | 400 | normal | `#0a0a0a` | — |
| Helper / caption | 12px | 16px | 400 | normal | `#8793a3` | `text-xs` |

> **The KPI letter-spacing is not a typo.** `tracking-[1.92px]` on a 32px number is a *positive* 0.06em. It is what makes big numbers read as "instrument display" rather than "headline". Copy it exactly.

### 2.2 Colour

#### 2.2.1 Neutral / structural ramp (the backbone)

| Token | Hex | Where it is used |
|---|---|---|
| `--bg-base` | `#f5f5fa` | App canvas, sidebar background, hover fills |
| `--bg-body` / `--bg-card` / `--bg-float` | `#ffffff` | Content panel, cards, inputs, popovers |
| `--bg-well` | `rgba(57,70,91,0.03)` | **The tinted well** — KPI blocks, chart plot backgrounds |
| `--bg-item-active` | `rgba(57,70,91,0.05)` | Sidebar active row, icon chips |
| `--border-default` / `--border-sub-500` | `#d5d5e8` | All hairline borders, chart gridlines |
| `--border-hover` | `#bdbdd6` | Border on hover for interactive surfaces |
| `--border-divider` | `rgba(57,70,91,0.15)` | Table row rules, list separators |
| `--border-soft-300` | `rgba(0,0,0,0.05)` | Ultra-subtle internal dividers, disabled borders |
| `--border-selected` | `#172131` | Active tab underline, selected card outline |
| `--text-primary` | `#172131` | Headings, values, active nav, emphasis |
| `--text-secondary` | `#606a78` | Body copy, idle nav labels, table cells |
| `--text-sub` / `--text-placeholder` | `#8793a3` | Section labels, placeholders, idle tabs |
| `--text-soft-400` | `#99a0ae` | De-emphasised metadata |
| `--text-disabled` | `#cacfd8` | Disabled labels |
| `--icon-disabled` | `#c3ccd9` | Disabled icons |
| `--text-white` / `--icon-white` | `#ffffff` | On dark surfaces |
| `--comp-tooltip` | `#222331` | Tooltip background |
| `--bg-surface-800` | `#222530` | Dark inverted surfaces (code, terminal) |
| `--bg-mask` | `rgba(0,0,0,0.4)` | Modal scrim |

#### 2.2.2 Semantic / state colours

| Meaning | Base | Light background | Dark text-on-light |
|---|---|---|---|
| Success / positive | `#1fc16b` | `#d1fae5` | `#0a5c37` |
| Error / destructive | `#fb3748` (fill) · `#f54a45` (border) | `#ffebec` | `#8c1a20` |
| Warning | `#ff8800` | `#fbf5e0` | `#7a4a00` |
| Information / primary accent | `#6895ff` | `#ebf1ff` | `#122368` |
| Neutral / draft | `#8793a3` | `#f5f5fa` | `#172131` |
| Attention (icon yellow) | `#eab308` | `#fbf5e0` | — |

Destructive borders use a translucent variant: `rgba(245,74,69,0.2)`.

#### 2.2.3 Categorical chart palette (12 colours, in order)

```
1  #82a7fc   blue          7  #f57ac0   pink
2  #7edafb   cyan          8  #64e8d6   teal
3  #ad82f7   purple        9  #e58fe5   orchid
4  #f7dc82   sand         10  #d2e76a   lime
5  #f98e8b   coral        11  #7b83ea   indigo
6  #ffba6b   amber        12  #8ee085   green
```

Plus the **primary series colour** used for single-series charts: `#6895ff` (a touch more saturated than palette slot 1).

Properties of this palette worth preserving if you extend it: every colour sits at roughly the same lightness (L\* ≈ 78–84) and medium-low saturation, so no single series shouts. Hues walk around the wheel rather than clustering. Assign strictly **in order** — never let a chart pick colours by hash, or two screens will disagree about what "Returns" is coloured.

### 2.3 Radius scale

| Token | Value | Applies to |
|---|---|---|
| `--radius-xs` | `4px` | Status dots' containers, checkbox |
| `--radius-sm` | `6px` | Inline chips, tab hover pill, small badges |
| `--radius-md` | `8px` | **Buttons, inputs, selects, sidebar nav rows, dropdown items** |
| `--radius-lg` | `12px` | Tinted wells, chart plot area, avatars-on-square, dropdown menus |
| `--radius-xl` | `16px` | **Cards, content panel, modals** |
| `--radius-full` | `9999px` | Avatars, status dots, pill counters |

### 2.4 Elevation (floating layers only)

```css
--shadow-s1: 0 2px 8px 2px rgba(31,35,41,.02), 0 2px 4px 0 rgba(31,35,41,.02), 0 1px 2px 2px rgba(31,35,41,.02);
--shadow-s2: 0 4px 16px 4px rgba(31,35,41,.03), 0 2px 6px -4px rgba(31,35,41,.04), 0 3px 6px 0 rgba(31,35,41,.03);
--shadow-s3: 0 6px 18px 6px rgba(31,35,41,.03), 0 3px 6px -6px rgba(31,35,41,.05), 0 4px 8px 0 rgba(31,35,41,.03);
--shadow-s5: 0 10px 36px 10px rgba(31,35,41,.04), 0 8px 24px 0 rgba(31,35,41,.04), 0 6px 12px -10px rgba(31,35,41,.06);
--shadow-sm: 0 1px 3px 0 rgba(0,0,0,.1), 0 0 2px 0 rgba(0,0,0,.1);
```

| Layer | Shadow |
|---|---|
| Cards, panels, tables | **none** |
| Dropdown / select menu / combobox | `--shadow-s2` |
| Popover, date picker, command palette | `--shadow-s3` |
| Modal / dialog / sheet | `--shadow-s5` |
| Toast | `--shadow-s3` |
| Sticky toolbar when content scrolls under it | `--shadow-sm` |

Note the shadows are built from **three low-alpha layers with a slight spread**, not one big blur. That is what keeps them from looking muddy on the `#f5f5fa` canvas.

### 2.5 Spacing & sizing rhythm

Base unit **4px**. Used steps: `4, 6, 8, 12, 16, 20, 24, 32, 40, 48`.

| Constant | Value |
|---|---|
| Sidebar width (expanded) | `260px` (incl. `16px` right padding → 244px usable) |
| Sidebar width (collapsed) | `72px` |
| Control height (button/input/select/nav row) | `32px` |
| Tall control height (primary CTA, search bar) | `36px` |
| Tab strip height | `40px` |
| Page header row height | `44px` |
| Icon size in controls | `16px` |
| Icon size in nav | `16px` |
| Avatar (workspace / user) | `32px` |
| Content panel padding | `16px` |
| Card padding | `16px 20px 24px` |
| Card internal gap (title → body) | `24px` |
| Dashboard grid gutter | `16px` |
| Minimum app width | `1440px` (horizontal scroll below that) |

### 2.6 The border language

There are exactly four border treatments. Using a fifth is how a screen starts looking off-system.

```css
/* 1. Structural hairline — cards, panels, controls */
border: 0.5px solid #d5d5e8;

/* 2. Hover on an interactive surface */
border-color: #bdbdd6;

/* 3. Divider inside a surface — table rows, list items */
border-bottom: 1px solid rgba(57,70,91,0.15);

/* 4. Selection / active */
border-color: #172131;   /* or 1.8px bottom border for tabs */
```

Focus is **not** a border change — it is a ring: `outline: none; box-shadow: 0 0 0 2px #ffffff, 0 0 0 4px rgba(104,149,255,0.45);` (offset ring so it reads on both white and the canvas).

### 2.7 Motion

```css
--ease: cubic-bezier(0.4, 0, 0.2, 1);
--dur-fast: 120ms;   /* colour, opacity on hover/press */
--dur-base: 200ms;   /* dropdown open, popover */
--dur-slow: 300ms;   /* sidebar collapse (width) */
```

Rules: transition `background-color`, `border-color`, `color`, `opacity`, `box-shadow`. Never transition `width`/`height` except the sidebar. Chart mount animation ≤ 400ms, and only on first render — not on data refresh (it makes live dashboards feel broken). Respect `prefers-reduced-motion` by dropping everything to `0ms`.

### 2.8 Iconography

Stroke icons, **1.5px stroke**, 16px in controls and nav, 20px in empty states, 24px maximum. Use **Lucide** (`lucide-react`) — it matches the original's geometry closely. Icons inherit `currentColor`; in an idle nav row that means `#606a78`, in an active row `#172131`. Never use filled/solid icon sets, and never mix two icon families.

---

## 3. Drop-in token files

### 3.1 `app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    /* ── Surfaces ─────────────────────────────── */
    --bg-canvas:        #f5f5fa;
    --bg-surface:       #ffffff;
    --bg-well:          rgba(57, 70, 91, 0.03);
    --bg-item-hover:    #f5f5fa;
    --bg-item-active:   rgba(57, 70, 91, 0.05);
    --bg-inverted:      #222530;
    --bg-tooltip:       #222331;
    --bg-scrim:         rgba(0, 0, 0, 0.4);

    /* ── Borders ──────────────────────────────── */
    --border-default:   #d5d5e8;
    --border-hover:     #bdbdd6;
    --border-divider:   rgba(57, 70, 91, 0.15);
    --border-soft:      rgba(0, 0, 0, 0.05);
    --border-selected:  #172131;

    /* ── Text ─────────────────────────────────── */
    --text-primary:     #172131;
    --text-secondary:   #606a78;
    --text-sub:         #8793a3;
    --text-soft:        #99a0ae;
    --text-disabled:    #cacfd8;
    --text-inverted:    #ffffff;

    /* ── State ────────────────────────────────── */
    --success:          #1fc16b;
    --success-bg:       #d1fae5;
    --error:            #fb3748;
    --error-border:     #f54a45;
    --error-bg:         #ffebec;
    --warning:          #ff8800;
    --warning-bg:       #fbf5e0;
    --info:             #6895ff;
    --info-bg:          #ebf1ff;
    --info-dark:        #122368;

    /* ── Charts ───────────────────────────────── */
    --chart-primary:    #6895ff;
    --chart-grid:       #d5d5e8;
    --chart-axis:       #737373;
    --chart-bg:         rgba(57, 70, 91, 0.03);
    --chart-1:  #82a7fc;  --chart-2:  #7edafb;  --chart-3:  #ad82f7;
    --chart-4:  #f7dc82;  --chart-5:  #f98e8b;  --chart-6:  #ffba6b;
    --chart-7:  #f57ac0;  --chart-8:  #64e8d6;  --chart-9:  #e58fe5;
    --chart-10: #d2e76a;  --chart-11: #7b83ea;  --chart-12: #8ee085;

    /* ── Radius ───────────────────────────────── */
    --radius-xs: 4px;  --radius-sm: 6px;  --radius-md: 8px;
    --radius-lg: 12px; --radius-xl: 16px;

    /* ── Elevation ────────────────────────────── */
    --shadow-s1: 0 2px 8px 2px rgba(31,35,41,.02), 0 2px 4px 0 rgba(31,35,41,.02), 0 1px 2px 2px rgba(31,35,41,.02);
    --shadow-s2: 0 4px 16px 4px rgba(31,35,41,.03), 0 2px 6px -4px rgba(31,35,41,.04), 0 3px 6px 0 rgba(31,35,41,.03);
    --shadow-s3: 0 6px 18px 6px rgba(31,35,41,.03), 0 3px 6px -6px rgba(31,35,41,.05), 0 4px 8px 0 rgba(31,35,41,.03);
    --shadow-s5: 0 10px 36px 10px rgba(31,35,41,.04), 0 8px 24px 0 rgba(31,35,41,.04), 0 6px 12px -10px rgba(31,35,41,.06);

    /* ── Motion ───────────────────────────────── */
    --ease: cubic-bezier(.4, 0, .2, 1);
  }

  html { font-feature-settings: "cv11", "ss01"; }

  body {
    @apply antialiased;
    font-family: Inter, "Inter Fallback", system-ui, -apple-system, "Segoe UI", sans-serif;
    background: var(--bg-canvas);
    color: var(--text-primary);
    font-size: 16px;      /* matches source; the interface default of 14px is
                             applied with `text-sm` on the app shell, not here,
                             so `em`-based sizing in third-party components stays sane */
    line-height: 24px;
    min-width: 1440px;
  }

  /* Tabular figures everywhere numbers matter */
  .tnum, td, th, .kpi { font-variant-numeric: tabular-nums; }

  /* Focus ring — never a border change */
  :where(button, a, input, select, textarea, [tabindex]):focus-visible {
    outline: none;
    box-shadow: 0 0 0 2px #fff, 0 0 0 4px rgba(104,149,255,.45);
    border-radius: var(--radius-md);
  }

  /* Thin scrollbars that match the border colour */
  ::-webkit-scrollbar { width: 10px; height: 10px; }
  ::-webkit-scrollbar-thumb { background: var(--border-default); border-radius: 9999px; border: 3px solid transparent; background-clip: content-box; }
  ::-webkit-scrollbar-thumb:hover { background: var(--border-hover); background-clip: content-box; }
  ::-webkit-scrollbar-track { background: transparent; }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after { animation-duration: .01ms !important; transition-duration: .01ms !important; }
  }
}
```

### 3.2 `tailwind.config.ts`

```ts
import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas:   "var(--bg-canvas)",
        surface:  "var(--bg-surface)",
        well:     "var(--bg-well)",
        item: {
          hover:  "var(--bg-item-hover)",
          active: "var(--bg-item-active)",
        },
        line: {
          DEFAULT:  "var(--border-default)",
          hover:    "var(--border-hover)",
          divider:  "var(--border-divider)",
          soft:     "var(--border-soft)",
          selected: "var(--border-selected)",
        },
        ink: {
          DEFAULT:  "var(--text-primary)",
          secondary:"var(--text-secondary)",
          sub:      "var(--text-sub)",
          soft:     "var(--text-soft)",
          disabled: "var(--text-disabled)",
        },
        state: {
          success: "var(--success)", "success-bg": "var(--success-bg)",
          error:   "var(--error)",   "error-bg":   "var(--error-bg)",
          warning: "var(--warning)", "warning-bg": "var(--warning-bg)",
          info:    "var(--info)",    "info-bg":    "var(--info-bg)",
        },
        chart: {
          primary: "var(--chart-primary)",
          grid:    "var(--chart-grid)",
          axis:    "var(--chart-axis)",
          1: "var(--chart-1)",  2: "var(--chart-2)",  3: "var(--chart-3)",
          4: "var(--chart-4)",  5: "var(--chart-5)",  6: "var(--chart-6)",
          7: "var(--chart-7)",  8: "var(--chart-8)",  9: "var(--chart-9)",
          10:"var(--chart-10)", 11:"var(--chart-11)", 12:"var(--chart-12)",
        },
      },
      borderRadius: {
        xs: "var(--radius-xs)", sm: "var(--radius-sm)", md: "var(--radius-md)",
        lg: "var(--radius-lg)", xl: "var(--radius-xl)",
      },
      boxShadow: {
        s1: "var(--shadow-s1)", s2: "var(--shadow-s2)",
        s3: "var(--shadow-s3)", s5: "var(--shadow-s5)",
      },
      borderWidth: { hairline: "0.5px" },
      spacing: { 4.5: "18px", 13: "52px", 15: "60px", sidebar: "260px", "sidebar-collapsed": "72px" },
      fontFamily: { sans: ["Inter", "Inter Fallback", "system-ui", "sans-serif"] },
      transitionTimingFunction: { standard: "cubic-bezier(.4,0,.2,1)" },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
```

---

## 4. Layout architecture

### 4.1 App shell anatomy

```
┌──────────────────────────────────────────────────────────────────────────────┐
│  BODY  ·  bg #f5f5fa  ·  display:flex  ·  h-screen  ·  min-w-[1440px]        │
│                                                                              │
│ ┌───────────────────┐  ┌──────────────────────────────────────────────────┐  │
│ │ ASIDE  w-[260px]  │  │ CONTENT PANEL                                    │  │
│ │ pr-4              │  │ flex-1 · min-h-0 · m-1 · rounded-xl(16px)        │  │
│ │ bg #f5f5fa        │  │ border 0.5px #d5d5e8 · bg #fff · p-4            │  │
│ │ flex-col          │  │                                                  │  │
│ │                   │  │ ┌──────────────────────────────────────────────┐ │  │
│ │  ▸ Brand   h-14   │  │ │ PAGE HEADER  h-11 · py-2 pl-2 pr-6           │ │  │
│ │  ▸ Workspace card │  │ │  "Inventory"  20/500          [·] [·] [·]    │ │  │
│ │  ────────────     │  │ ├──────────────────────────────────────────────┤ │  │
│ │  DEPLOY           │  │ │ TAB STRIP  h-10 · border-b 1px               │ │  │
│ │   ▫ nav row h-8   │  │ │  Overview | Stock | Movements      [+]       │ │  │
│ │   ▫ nav row h-8   │  │ ├──────────────────────────────────────────────┤ │  │
│ │  DATA             │  │ │ TOOLBAR  h-8 controls · gap-2 · my-3         │ │  │
│ │   ▫ …             │  │ │  [Date range] [Filter] [Group]   [+ Add] [⋯] │ │  │
│ │  MONITOR          │  │ ├──────────────────────────────────────────────┤ │  │
│ │   ▫ …             │  │ │ SCROLL REGION  overflow-y:auto               │ │  │
│ │  SYSTEM           │  │ │                                              │ │  │
│ │   ▫ …             │  │ │   ┌──────┐ ┌──────┐ ┌──────┐   grid gap-4    │ │  │
│ │  ─── spacer ───   │  │ │   │ KPI  │ │ KPI  │ │ KPI  │                 │ │  │
│ │  ▸ Trial banner   │  │ │   └──────┘ └──────┘ └──────┘                 │ │  │
│ │  ▸ User switcher  │  │ │   ┌────────────────┐ ┌────────────────┐      │ │  │
│ │  ▸ Help | Updates │  │ │   │   chart card   │ │   chart card   │      │ │  │
│ └───────────────────┘  │ │   └────────────────┘ └────────────────┘      │ │  │
│                        │ └──────────────────────────────────────────────┘ │  │
│                        └──────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Critical detail:** the content panel is *inset*, not flush. It has ~4px of canvas visible above and to the right of it, which is what makes it read as a floating sheet. The sidebar's own `pr-4` (16px) creates the left gutter. Do not put the sidebar inside the white panel.

```tsx
// app/(dashboard)/layout.tsx
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen min-w-[1440px] overflow-x-auto bg-canvas antialiased">
      <Sidebar />
      <main className="relative z-10 m-1 min-h-0 flex-1 overflow-hidden rounded-xl border-hairline border-line bg-surface p-4">
        {children}
      </main>
    </div>
  );
}
```

### 4.2 Sidebar spec

| Property | Value |
|---|---|
| Element | `<aside>` |
| Width | `260px` expanded · `72px` collapsed |
| Transition | `transition-[width] duration-300 ease-in-out` |
| Background | `#f5f5fa` (same as canvas — no border, no separator) |
| Padding | `pr-4` on the aside; `px-3` on the inner nav list |
| Layout | `flex flex-col h-full`; nav list `flex-1 overflow-y-auto`; footer pinned |

**Vertical stack, top to bottom:**

1. **Brand** — logo mark + wordmark, ~`h-14`, `px-4`. Wordmark hidden when collapsed.
2. **Workspace switcher card** — see 5.3.
3. **Nav groups** — each group is `[uppercase label] + [rows]`, `gap-1` between rows, `mt-6` between groups.
4. **Spacer** — `flex-1`.
5. **Footer stack** — onboarding/progress banner, plan banner, user switcher, then a `Help · Updates` row at 12px.

### 4.3 Page header

```tsx
<header className="flex h-11 items-center justify-between py-2 pl-2 pr-6">
  <h1 className="text-xl font-medium leading-7 text-ink">{title}</h1>
  <div className="flex items-center gap-2">{actions}</div>
</header>
```

No border under the header. No breadcrumbs by default — the sidebar *is* the breadcrumb. If your ERP has genuinely deep hierarchies (e.g. `Sales ▸ Orders ▸ SO-10422`), put a 12px `#8793a3` breadcrumb line *above* the title and shrink the header to `h-14` to fit both.

### 4.4 Tab strip (secondary navigation)

```tsx
<nav className="flex items-center gap-4 border-b border-line-soft">
  {tabs.map(t => (
    <button key={t.id}
      className={cn(
        "-mb-px inline-flex h-10 items-center whitespace-nowrap border-b-[1.8px] px-0 text-sm transition-colors",
        active === t.id
          ? "border-line-selected font-medium text-ink"
          : "border-transparent font-normal text-ink-sub hover:text-ink-secondary"
      )}>
      <span className="flex items-center gap-1.5 rounded-sm px-1 hover:bg-item-hover">
        <Icon className="size-4" /> {t.label}
      </span>
    </button>
  ))}
  <button className="grid size-6 place-items-center rounded-sm border-hairline border-line text-ink-sub hover:border-line-hover">
    <Plus className="size-3.5" />
  </button>
</nav>
```

Exact measured values: strip height `40px`, active underline `1.8px solid #172131` pulled down by `-1px` to sit on the container's border, label `14px/500`, tracking `-0.084px`, idle colour `#8793a3`, hover background on the *label* (a 6px-radius pill), not the whole tab.

### 4.5 Toolbar

A single horizontal row, `gap-2`, all controls `h-8`. Left cluster = scope controls (date range, filters, grouping). Right cluster = actions (`+ Add`, overflow `⋯`). Left and right are separated by `justify-between`, not by a divider.

When the page scrolls, the header + tabs + toolbar stay fixed and only the content region scrolls (`overflow-y: auto` on the region, `min-h-0` on its flex parent). Add `shadow-sm` to the toolbar only while `scrollTop > 0`.

### 4.6 The dashboard grid

12 columns, `16px` gutter, rows auto. Cards declare a column span.

```tsx
<div className="grid grid-cols-12 gap-4">
  <Card className="col-span-4" />   {/* KPI  — 3 across */}
  <Card className="col-span-4" />
  <Card className="col-span-4" />
  <Card className="col-span-8" />   {/* main chart */}
  <Card className="col-span-4" />   {/* side chart */}
  <Card className="col-span-3" />   {/* 4-across donut row */}
  <Card className="col-span-3" />
  <Card className="col-span-3" />
  <Card className="col-span-3" />
  <Card className="col-span-12" />  {/* full-width table */}
</div>
```

**Canonical span vocabulary** — pick from these, don't invent:

| Span | Use |
|---|---|
| `col-span-3` | Donut / distribution tile, 4 across |
| `col-span-4` | KPI card, or one of a 3-across chart row |
| `col-span-6` | Half-width comparison chart |
| `col-span-8` | Primary trend chart (paired with a 4) |
| `col-span-12` | Table, timeline, or a wide multi-series chart |

Card heights snap to `234px` (KPI), `290px` (short chart), `398px` (standard chart), `auto` (tables). Never let two cards in the same row have different heights — use `h-full` on the card and `items-stretch` on the row.

If you want user-rearrangeable dashboards (the original supports it), use `react-grid-layout` with `rowHeight={8}`, `margin={[16,16]}`, `cols={12}` and `containerPadding={[0,0]}`; the drag handle is the card title.

---

## 5. Component specifications

Each spec gives: **anatomy → exact values → states → code**.

> **Measured vs derived.** §5.1–5.6 are measured directly off the live DOM — the pixel and hex values are what the original actually renders. §5.7 (data table), §5.8 (status badges), §5.9 (overlays) and §5.10 (empty/loading/error) do **not** exist on the analytics page that was measured; they are derived strictly from the measured token set (same radii, same borders, same ink ramp, same control height) so they sit inside the system rather than beside it. Where a value there is a judgement call it is one you can change safely; the measured values in §5.1–5.6 are not.

### 5.1 Card (the atom of the whole system)

**Anatomy:** `[title row] → (24px gap) → [body]`

| Property | Value |
|---|---|
| Background | `#ffffff` |
| Border | `0.5px solid #d5d5e8` |
| Radius | `16px` |
| Padding | `16px 20px 24px` (top / sides / bottom) |
| Internal gap | `24px` (title → body); `16px` between body sub-blocks |
| Shadow | **none** |
| Overflow | `hidden` |
| Layout | `flex flex-col justify-between h-full` |

**States**
- Hover (only if clickable): `border-color: #bdbdd6`. Nothing else moves.
- Selected: `border-color: #172131`, still 0.5px.
- Dragging (rearrangeable dashboards): `shadow-s3` + `opacity-95`.
- Loading: keep the exact card frame, replace the body with a shimmer block that has the well background.

```tsx
export function Card({ title, action, children, className }: CardProps) {
  return (
    <div className={cn(
      "relative flex h-full flex-col justify-between gap-6 overflow-hidden",
      "rounded-xl border-hairline border-line bg-surface px-5 pb-6 pt-4",
      "transition-colors", className
    )}>
      <div className="flex items-start justify-between gap-2">
        <h3 className="block truncate text-base font-medium leading-6 tracking-tight text-ink">
          {title}
        </h3>
        {action}
      </div>
      <div className="relative flex h-full flex-col gap-4">{children}</div>
    </div>
  );
}
```

> The measured title has `pr-[90px]` so it truncates *before* reaching the top-right action cluster. Reproduce this with `gap-2` + `min-w-0 truncate` on the title and `shrink-0` on the action.

### 5.2 KPI / metric card

The single most copied pattern in this system. A card whose body is one **tinted well** containing one huge number.

| Property | Value |
|---|---|
| Well background | `rgba(57,70,91,0.03)` |
| Well radius | `12px` |
| Well padding | `16px 0` |
| Well layout | `flex h-full flex-col items-center justify-center` |
| Value | `32px / 500 / tracking 1.92px / #172131`, tabular-nums |
| Card height | `234px` |

```tsx
export function MetricCard({ title, value, delta, unit }: MetricCardProps) {
  return (
    <Card title={title} className="h-[234px]">
      <div className="flex h-full flex-col items-center justify-center rounded-lg bg-well py-4">
        <div className="flex items-center justify-center gap-2">
          <span className="kpi text-[32px] font-medium tracking-[1.92px] text-ink">{value}</span>
          {unit && <span className="text-sm text-ink-sub">{unit}</span>}
        </div>
        {delta && <DeltaBadge value={delta} className="mt-2" />}
      </div>
    </Card>
  );
}
```

**Delta badge** (not in the original, but the correct extension of the system for an ERP):

```tsx
<span className={cn(
  "inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-xs font-medium tabular-nums",
  up ? "bg-state-success-bg text-[#0a5c37]" : "bg-state-error-bg text-[#8c1a20]"
)}>
  {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
  {Math.abs(pct).toFixed(1)}%
</span>
```

**Never** colour the KPI number itself green or red — the number stays `#172131` and the badge carries the sentiment. And decide once, globally, whether "up" is good; for inventory *ageing* or *defect rate*, up is bad, so pass an `invert` flag rather than hard-coding.

**Number formatting for an ERP** — apply these consistently or the dashboard will feel amateur:
- Currency: `₹12.4L` / `$1.2M` — abbreviate above 5 digits, full precision in tooltips and tables only.
- Counts: thousands separators, no decimals.
- Percentages: one decimal, always with the `%` as a smaller `text-sm text-ink-sub` sibling.
- Durations: `34s`, `4m 12s`, `2h 05m` — never raw seconds.
- Zero state: render `0`, never `—`. Render `—` only for *unknown*, and `text-ink-disabled` for it.

### 5.3 Sidebar — workspace switcher

| Property | Value |
|---|---|
| Container | `h-14`, `rounded-lg`, `border-hairline border-line`, `bg-surface`, `px-2`, `gap-2`, full width of nav |
| Avatar | `32px`, `rounded-lg`, gradient fill, white initial `14px/500` |
| Label | `Workspace` — `11–12px`, `#8793a3` |
| Value | workspace name — `14px/500`, `#172131`, truncate |
| Affordance | `ChevronsUpDown` 14px, `#8793a3`, right-aligned |
| Hover | `border-color: #bdbdd6` |
| Menu | `--shadow-s2`, `rounded-lg`, `p-1`, items `h-8 rounded-md px-2 text-sm` |

For an ERP this slot is where **Company / Legal entity / Branch / Fiscal year** lives. That is the single most important adaptation: ERPs are multi-entity, and the entity selector must be permanently visible, never buried in settings.

### 5.4 Sidebar — section label & nav row

```tsx
{/* Section label */}
<div className="px-2 pb-1 pt-6 text-xs font-medium uppercase text-ink-sub">
  {group.label}
</div>

{/* Nav row */}
<Link href={item.href} className="block">
  <div className={cn(
    "flex h-8 items-center gap-2 overflow-hidden rounded-md px-2 py-1.5 transition-colors",
    active ? "bg-item-active" : "hover:bg-item-hover"
  )}>
    <item.icon className={cn("size-4 shrink-0", active ? "text-ink" : "text-ink-secondary")} />
    <span className={cn(
      "whitespace-nowrap text-sm leading-tight",
      active ? "font-medium text-ink" : "font-normal text-ink-secondary"
    )}>{item.label}</span>
    {item.badge && <span className="ml-auto rounded-full bg-state-error px-1.5 text-[11px] font-medium text-white">{item.badge}</span>}
  </div>
</Link>
```

Measured: row `232 × 32px`, radius `8px`, padding `6px 8px`, gap `8px`, active fill `rgba(57,70,91,0.05)`.

There is **no left accent bar** on the active row, **no bold**, and **no colour tint**. The active state is a grey pill + a weight bump from 400 to 500. That restraint is a defining trait — do not "improve" it with a blue highlight.

Disabled/locked rows (e.g. `Billing` when the plan doesn't include it) render at `text-ink-disabled` with `opacity-60`, still visible, with a small lock icon on the right.

### 5.5 Buttons

All buttons are `h-8`, `rounded-md` (8px), `px-2`, `gap-2`, `text-sm font-medium`, icon `16px`, `transition-colors`.

| Variant | Background | Border | Text | Hover |
|---|---|---|---|---|
| **Secondary** (the default in this app) | transparent | `0.5px #d5d5e8` | `#172131` | `bg #f5f5fa`, border `#bdbdd6` |
| **Primary** | `#172131` | none | `#ffffff` | `bg #2b3854` |
| **Accent** (rare, for the one main CTA) | `#6895ff` | none | `#ffffff` | `bg #5480ea` |
| **Ghost** | transparent | none | `#606a78` | `bg #f5f5fa`, text `#172131` |
| **Destructive** | transparent | `0.5px rgba(245,74,69,.2)` | `#f54a45` | `bg #ffebec` |
| **Icon-only** | as above, `size-8`, `p-0`, icon centred | | | |

Disabled: `opacity-50`, `pointer-events-none`, text `#cacfd8`.
Loading: replace the leading icon with a 14px spinner, keep the label, keep the width (use `min-w` not conditional content).

Notice that the *toolbar* buttons in the original are all **secondary** — a screen full of grey-outline buttons with at most one filled primary is the correct density. Three blue buttons in a toolbar is a system violation.

### 5.6 Inputs, selects, search

| Property | Value |
|---|---|
| Height | `32px` (`36px` for a page-level search) |
| Radius | `8px` |
| Border | `0.5px #d5d5e8` → hover `#bdbdd6` → focus ring (no border change) |
| Background | `#ffffff` |
| Padding | `0 8px`, `0 8px 0 30px` when there is a leading icon |
| Text | `14px/400 #172131` |
| Placeholder | `#8793a3` |
| Label above | `12px/500 #606a78`, `mb-1.5` |
| Helper text | `12px/400 #8793a3`, `mt-1.5` |
| Error | border `#f54a45`, helper text `#f54a45`, no red fill |

Selects/comboboxes open a menu with `rounded-lg`, `--shadow-s2`, `p-1`, `border-hairline border-line`; items are `h-8 rounded-md px-2 text-sm`, hover `bg-item-hover`, selected shows a 14px check on the right.

Date-range picker (very prominent in the original toolbar): a secondary button showing `CalendarIcon + "Jul 24 - Aug 20, 2026"`, opening a two-month popover at `--shadow-s3` with a left rail of presets (`Today`, `Last 7 days`, `Last 30 days`, `This month`, `This quarter`, `This FY`, `Custom`). For an ERP, **`This FY` and `Last FY` are mandatory presets** and the fiscal year start must come from company settings, not from January.

### 5.7 Data table (the ERP workhorse)

The original dashboard is chart-led, but an ERP is table-led. This spec is the correct extension of the system — every value is derived from the measured token set.

| Property | Value |
|---|---|
| Container | `rounded-xl border-hairline border-line bg-surface overflow-hidden` (a card with `p-0`) |
| Header row | `h-9`, `bg #f5f5fa`, sticky, `border-b 1px rgba(57,70,91,.15)` |
| Header cell | `12px/500 uppercase-off #606a78`, `px-3`, left-aligned (right for numeric) |
| Body row | `h-11` comfortable · `h-9` compact · `h-14` relaxed |
| Row divider | `1px solid rgba(57,70,91,.15)` |
| Row hover | `bg #f5f5fa` |
| Row selected | `bg rgba(57,70,91,.05)` + a `2px` left inset bar in `#172131` |
| Cell text | `14px/400 #606a78`; the **primary identifier column** is `14px/500 #172131` |
| Numeric cells | right-aligned, `tabular-nums` |
| Zebra striping | **none** — dividers only |
| Cell padding | `px-3` |
| Sticky first column | for tables wider than the panel: `sticky left-0 bg-surface` + a `1px` right divider |
| Empty cell | `—` in `#cacfd8` |

Column header interactions: click to sort (chevron appears on hover in `#8793a3`, stays in `#172131` when active), drag to reorder, right-edge drag to resize. A `⋯` menu per column for pin/hide.

Row actions live in a trailing `w-10` column that only reveals its `⋯` button on row hover — never a row of visible action buttons, which destroys the calm of the table.

Bulk selection: a leading `w-10` checkbox column; when `n > 0`, a floating action bar appears at the bottom centre of the panel (`rounded-xl`, `bg #222530`, `text-white`, `--shadow-s5`, `h-12`, `px-4`) reading `n selected` plus the bulk verbs.

Pagination sits *outside* the scroll area, in a `h-12` footer row with a top divider: `Rows per page [25 ▾]` on the left, `1–25 of 1,284` and `‹ ›` on the right, all `text-sm text-ink-secondary`.

### 5.8 Status badges

`rounded-sm` (6px) · `h-5` · `px-1.5` · `text-xs font-medium` · light background + dark text from the same hue. A `6px` round dot in the base colour may lead the label.

| ERP state | Background | Text |
|---|---|---|
| Draft | `#f5f5fa` | `#606a78` |
| Pending / Awaiting approval | `#fbf5e0` | `#7a4a00` |
| Approved / Active / Paid | `#d1fae5` | `#0a5c37` |
| In progress / Partially received | `#ebf1ff` | `#122368` |
| Rejected / Overdue / Failed | `#ffebec` | `#8c1a20` |
| Cancelled / Closed | `#f5f5fa` | `#8793a3` |

Six states, exactly. If your workflow has fifteen, map them onto these six buckets — colour is not how you communicate a fifteen-state machine.

### 5.9 Overlays

| Overlay | Radius | Shadow | Width | Padding |
|---|---|---|---|---|
| Dropdown menu | `12px` | `s2` | `min-w-[200px]` | `p-1` |
| Popover / date picker | `12px` | `s3` | content | `p-3` |
| Dialog / modal | `16px` | `s5` | `440 / 560 / 720px` | `p-6`, header `pb-4`, footer `pt-4` |
| Sheet / side drawer | `16px` on the inner edge only | `s5` | `420 / 640px` | `p-6` |
| Command palette (⌘K) | `12px` | `s5` | `640px` | `p-2` |
| Tooltip | `6px` | none | auto | `px-2 py-1`, `bg #222331`, `text-white 12px` |
| Toast | `12px` | `s3` | `360px` | `p-3`, bottom-right stack, `gap-2` |

Scrim: `rgba(0,0,0,0.4)`. Dialog footer buttons are right-aligned, `gap-2`, with the primary action last.

### 5.10 Empty, loading and error states

**Empty** — centred in the card/table body: a 20px `#8793a3` icon in a 40px `bg-well rounded-lg` chip, a `14px/500 #172131` line, a `12px #8793a3` explanation, then one secondary button. Vertical rhythm `gap-2`, block max-width `280px`.

**Loading** — skeletons, not spinners, for anything with known shape. Skeleton block: `bg-well`, matching radius, with a slow shimmer (`1.6s`, `ease-in-out`, translate a `rgba(255,255,255,.6)` highlight). Cards keep their exact frame and height so nothing reflows when data lands. A spinner (14px, `#8793a3`) is only acceptable inside a button.

**Error** — inside the card body, not a toast, for data-fetch failures: a 20px `#f54a45` icon, `14px/500` "Couldn't load <thing>", `12px #8793a3` reason, and a `Retry` ghost button. Toasts are for the outcome of *user actions* only.

---

## 6. Data visualization system

Library: **Recharts** (that is what the original uses — `recharts-surface`, `recharts-cartesian-grid`, `recharts-area-area` classes are all present in the DOM).

### 6.1 The measured chart style

| Element | Exact spec |
|---|---|
| Plot background | none inside chart cards; `rgba(57,70,91,.03)` + `12px` radius when the chart is a *well* (as with KPI blocks) |
| Cartesian grid | horizontal lines only, `stroke #d5d5e8`, `strokeDasharray "3 3"`, `strokeWidth 1`, **no vertical lines** |
| Axis line | **hidden** (`axisLine={false}`) |
| Tick marks | **hidden** (`tickLine={false}`) |
| Tick labels | `12px`, `fill #737373`, weight 400 |
| Y axis width | `40px`, right-padded so labels never touch the plot |
| X axis | dates formatted `MMM d, yyyy` on wide charts, `MMM d` on narrow ones; the original shows **very few ticks** — let Recharts thin them, never rotate labels |
| Single-series line | `stroke #6895ff`, `strokeWidth 2`, `dot={false}`, `activeDot={{ r: 4 }}` |
| Single-series area fill | `linearGradient` vertical (`x1=0 y1=0 x2=0 y2=1`), stop `20% #6895FF @ 0.25` → stop `100% #6895FF @ 0.05` |
| Single data point | rendered as a `4px` dot in `#6895ff` (measured) — never leave a lone point invisible |
| Bar | `fill #6895ff`, `radius={[4,4,0,0]}`, `maxBarSize={48}`, `2px` gap between adjacent bars |
| Legend | bottom-left, `12px`, `#0a0a0a` label, preceded by an `8×8px` square swatch with `2px` radius |
| Margins | `{ top: 8, right: 8, bottom: 0, left: 0 }` — the card padding is the chart's margin |
| Animation | `isAnimationActive` true on mount only, `400ms`; disable on refresh |

The **defining visual signature** is: dotted horizontal gridlines + no axis lines + tiny grey ticks + one soft blue series with a gradient fade. Reproduce those four things and a chart reads as "this system" even before the colours are checked.

### 6.2 The palettes — and an honest warning

The original's 12-colour categorical palette is:

```
#82a7fc  #7edafb  #ad82f7  #f7dc82  #f98e8b  #ffba6b
#f57ac0  #64e8d6  #e58fe5  #d2e76a  #7b83ea  #8ee085
```

**I ran this palette through a colour-vision and contrast validator. It fails four checks:**

| Check | Result |
|---|---|
| Lightness band (OKLCH L 0.43–0.77) | **FAIL** — 6 of 12 sit above 0.83 (too pale) |
| Chroma floor (C ≥ 0.10) | **FAIL** — `#7edafb` reads as grey at C 0.099 |
| Colour-blind separation (adjacent) | PASS (worst ΔE 9.9 deutan) |
| Normal-vision separation | **FAIL** — `#ffba6b` ↔ `#f98e8b` ΔE 12.6 (needs ≥ 15) |
| Contrast vs white surface (3:1) | **WARN** — 11 of 12 below 3:1 |

That is fine for the original, which mostly draws **one** series at a time on big charts. It is **not** fine for an ERP, where you will routinely plot 6 warehouses, 8 cost centres, or 10 product families on one axis, and where someone will print the P&L chart in greyscale.

**So this document specifies two palettes. Choose per chart, not per app.**

#### A. Fidelity palette — use for 1–3 series, large marks, always with direct labels

Exactly the original twelve, in the original order. Because they fail the contrast check, they are only legal with **secondary encoding**: direct labels on the series, or a visible legend plus a table view. Never use them for a chart with more than 3 series, and never for small multiples.

#### B. ERP-safe palette — the default for anything with ≥ 4 series (**validated: all checks pass, light *and* dark**)

```
1  #5482f9   blue      5  #7479f7   indigo
2  #849505   olive     6  #e55055   red
3  #c25ac4   orchid    7  #0499bf   cyan
4  #37a52d   green     8  #c07804   amber
```

These are the original's own hues re-stepped to OKLCH `L 0.635` with chroma pushed to the in-gamut maximum (capped at 0.185) and then **re-ordered so that every adjacent pair separates**. Validator output:

```
[PASS] Lightness band       all 8 inside L 0.43–0.77
[PASS] Chroma floor         all 8 >= 0.1
[PASS] CVD separation       worst adjacent #0499bf↔#e55055 ΔE 17.0 (protan)
[PASS] Normal-vision floor  worst adjacent #c07804↔#0499bf ΔE 25.0
[PASS] Contrast vs surface  all 8 >= 3:1
```

Same result against a dark surface (`#1a1a19`), so it survives a future dark mode without a re-pick.

**Rules that apply to both palettes:**

- Assign in **fixed order**, never cycled and never hashed. Slot 1 always goes to the same entity across every screen — if "North region" is `#5482f9` on the sales dashboard it is `#5482f9` on the receivables dashboard.
- **A 9th series does not get a 9th colour.** Rank by value, keep the top 7, aggregate the rest into `Other` in `#8793a3`. If the user truly needs all 15, give them small multiples, not 15 hues.
- **Colour follows the entity, not the rank.** Filtering out a series must not repaint the survivors.
- **Status colours are reserved.** `#1fc16b / #ff8800 / #fb3748` mean good/warning/bad. They are never "series 4".
- **Text never wears the series colour.** Values, axis labels and legend text stay in the ink ramp; the swatch beside them carries identity.

#### Sequential & diverging (ERPs need both; the original has neither)

- **Sequential** (magnitude — stock cover, utilisation, heatmaps): one hue, light→dark, 5 steps off the blue:
  `#e8eefe · #b9cdfc · #8aabfa · #5482f9 · #2f5bc4`
- **Diverging** (polarity — budget variance, over/under, growth vs decline): red → neutral grey → green, with a **grey** midpoint, never a hue:
  `#c0392f · #e08c86 · #e8e8ef · #79c39a · #1f7a4d`
  Midpoint must be pinned to the meaningful zero (0% variance, break-even), not to the data's median.

### 6.3 Chart type selection matrix

| The question the user is asking | Form | Not this |
|---|---|---|
| "How did X move over time?" | Line (2px) or area with gradient | Bar-per-day |
| "How do these categories compare?" | Horizontal bar, sorted descending | Pie |
| "What's the composition?" (≤ 5 parts) | Donut with the total in the centre hole | Pie with labels around it |
| "What's the composition over time?" | Stacked area (100% if share matters) | Multi-line |
| "Where is the bottleneck?" | Funnel / stacked horizontal bar | Table of percentages |
| "Is this one number good?" | **Stat tile + delta badge — not a chart** | Gauge |
| "How are two measures related?" | Scatter with a trend line | Dual-axis line |
| "How is it distributed?" | Histogram or box plot | Average in a KPI card |
| "What happened to this record?" | Timeline / event rail | Table sorted by date |

**Never build a dual-axis chart.** Two measures at different scales become two charts, small multiples, or both indexed to 100 at a common base date. This is the single most common dashboard mistake and it is unambiguously wrong.

### 6.4 Reference chart implementation

```tsx
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

const AXIS = { fontSize: 12, fill: "var(--chart-axis)" };

export function TrendChart({ data, dataKey, label }: TrendChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="fill-primary" x1="0" y1="0" x2="0" y2="1">
            <stop offset="20%"  stopColor="var(--chart-primary)" stopOpacity={0.25} />
            <stop offset="100%" stopColor="var(--chart-primary)" stopOpacity={0.05} />
          </linearGradient>
        </defs>

        <CartesianGrid vertical={false} stroke="var(--chart-grid)" strokeDasharray="3 3" />

        <XAxis dataKey="date" axisLine={false} tickLine={false} tick={AXIS}
               tickMargin={12} minTickGap={40} />
        <YAxis width={40} axisLine={false} tickLine={false} tick={AXIS}
               tickFormatter={compact} />

        <Tooltip cursor={{ stroke: "var(--chart-grid)", strokeDasharray: "3 3" }}
                 content={<ChartTooltip />} />

        <Area type="monotone" dataKey={dataKey} name={label}
              stroke="var(--chart-primary)" strokeWidth={2}
              fill="url(#fill-primary)"
              dot={false} activeDot={{ r: 4, strokeWidth: 0 }}
              isAnimationActive animationDuration={400} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
```

**Tooltip** — always custom, never the Recharts default:

```tsx
function ChartTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border-hairline border-line bg-surface p-2.5 shadow-s2">
      <div className="mb-1.5 text-xs text-ink-sub">{formatDate(label)}</div>
      {payload.map(p => (
        <div key={p.name} className="flex items-center gap-2 text-sm">
          <span className="size-2 rounded-[2px]" style={{ background: p.color }} />
          <span className="text-ink-secondary">{p.name}</span>
          <span className="ml-auto font-medium tabular-nums text-ink">{format(p.value)}</span>
        </div>
      ))}
    </div>
  );
}
```

Every line/area chart gets a crosshair + tooltip; every bar/cell gets a per-mark tooltip. A chart with no hover layer is unfinished.

**Legend** — required whenever there are ≥ 2 series; omitted for a single series (the card title already names it). Bottom-left, `12px`, swatch is an `8×8` `rounded-[2px]` square. Clicking a legend entry toggles that series; toggled-off entries drop to `opacity-40` and keep their colour.

---

## 7. Applying this to an ERP

The style is from a voice-AI product; an ERP has different information density and different stakes. These are the adaptations that keep the aesthetic while making it correct for enterprise data.

### 7.1 Navigation IA

Keep the uppercase-grouped sidebar exactly, and map ERP modules onto it. A workable grouping for a mid-market ERP:

```
[ Company / Entity switcher  ▾ ]        ← replaces "Workspace"
  ▫ Home

OPERATIONS
  ▫ Sales Orders          ▫ Purchase Orders
  ▫ Invoices              ▫ Deliveries

INVENTORY
  ▫ Stock on hand         ▫ Movements
  ▫ Warehouses            ▫ Adjustments

FINANCE
  ▫ Receivables           ▫ Payables
  ▫ Ledger                ▫ Bank & Cash

PEOPLE
  ▫ Employees             ▫ Attendance         ▫ Payroll

INSIGHTS
  ▫ Dashboards            ▫ Reports            ▫ Alerts

SYSTEM
  ▫ Masters               ▫ Integrations       ▫ Users & Roles      ▫ Settings
```

Rules: **maximum 4–6 rows per group**, maximum 6 groups. If you exceed that, the second level belongs in the tab strip inside the module, not in the sidebar. Badge counts (pending approvals, low-stock alerts) go on the right of the row as a small red pill — but only on rows where the number demands *action*.

### 7.2 The dashboard page pattern

Every ERP dashboard page should follow this order top-to-bottom. It is the same order the original uses, and it matches how people read.

1. **Scope bar** — entity + date range + one or two dimension filters. Always visible, always at the top, never inside a drawer.
2. **KPI row** — 3 or 4 metric cards. These answer "is anything on fire?"
3. **Primary trend** — one `col-span-8` chart showing the module's headline measure over the selected range, paired with a `col-span-4` breakdown (donut or ranked bar).
4. **Secondary charts** — a row of 3 or 4 smaller cards.
5. **Actionable table** — the list of records that need a human: overdue invoices, below-reorder-point SKUs, unapproved POs. This is what makes an ERP dashboard useful rather than decorative, and it belongs at the bottom, `col-span-12`.

### 7.3 KPI selection per module (pick 3–4, never more)

| Module | KPI row |
|---|---|
| Sales | Revenue (period) · Orders · Avg order value · Fulfilment rate |
| Purchase | PO value committed · Open POs · On-time delivery % · Avg lead time |
| Inventory | Stock value · SKUs below reorder point · Stock cover (days) · Dead stock value |
| Finance | Cash position · Receivables outstanding · DSO (days) · Overdue > 90d |
| Manufacturing | Output units · OEE % · Scrap rate · WIP value |
| HR | Headcount · Attrition (12m) · Absence rate · Open positions |

For each KPI, always ship: the value, the unit, the comparison period, and the delta badge. A number with no comparison is not a KPI, it is trivia.

### 7.4 ERP-specific colour semantics

Beyond the six status badges in §5.8, ERPs need **ageing** and **threshold** ramps. Use the sequential/diverging ramps from §6.2, never the categorical palette:

- **Receivables ageing buckets** (Current / 1–30 / 31–60 / 61–90 / 90+): the diverging ramp read one-directionally — `#e8e8ef · #f7dc82(→#c07804) · #ff8800 · #f54a45 · #8c1a20`. Ageing is ordinal, so lightness must increase monotonically with severity.
- **Stock level vs reorder point**: below reorder = `#fb3748`, within 20% above = `#ff8800`, healthy = `#1fc16b`, overstocked = `#6895ff`. Four states, always paired with an icon so it is not colour-alone.
- **Budget variance**: the diverging red→grey→green ramp with the midpoint pinned to 0%.

### 7.5 Density modes

ERP users live in these screens for eight hours. Ship a density toggle in user settings that switches a single CSS variable:

```css
[data-density="compact"]     { --row-h: 36px; --control-h: 28px; --card-pad: 12px 16px 16px; }
[data-density="comfortable"] { --row-h: 44px; --control-h: 32px; --card-pad: 16px 20px 24px; } /* default */
[data-density="relaxed"]     { --row-h: 56px; --control-h: 36px; --card-pad: 20px 24px 28px; }
```

Nothing else changes — not type size, not radii, not colour. That is the whole point of a token system.

### 7.6 Things an ERP needs that this style has no precedent for — and the correct extension

| Need | Correct extension of this system |
|---|---|
| Approval workflow step indicator | Horizontal stepper: `24px` circles, done = `#172131` fill + white check, current = `#172131` ring on white, pending = `#d5d5e8` ring; connector `1px #d5d5e8`; labels `12px` |
| Document preview (invoice/PO) | Side sheet at `640px`, `--shadow-s5`, document rendered inside a `bg-well` `12px` well |
| Multi-level grouped table | Group header row: `h-9`, `bg #f5f5fa`, `12px/500 #172131`, chevron on the left, aggregate values right-aligned in the same columns |
| Editable grid cell | Cell becomes an `h-8` input with an `8px` radius and the focus ring; dirty cells get a `2px` left bar in `#6895ff` until saved |
| Audit trail | Vertical timeline, `1px #d5d5e8` rail, `8px` dots, `12px #8793a3` timestamps, `14px #172131` actor + action |
| Print / export view | A `210mm` white sheet with no canvas, no shadows, `#172131` on white, charts re-rendered with the ERP-safe palette and direct labels |

---

## 8. Accessibility

- **Contrast (measured, WCAG 2.1).**

  | Ink | on `#ffffff` | on canvas `#f5f5fa` |
  |---|---|---|
  | `#172131` | **16.17:1** ✓ | 14.88:1 ✓ |
  | `#606a78` | **5.48:1** ✓ | 5.05:1 ✓ |
  | `#737373` (axis ticks) | 4.74:1 ✓ | 4.36:1 ✓ |
  | `#8793a3` | 3.12:1 — large/non-essential text only | **2.87:1 — fails even the 3:1 large-text bar** |
  | `#99a0ae` | 2.63:1 ✗ | 2.42:1 ✗ |
  | `#cacfd8` | 1.56:1 — decorative only | 1.44:1 |
  | `#6895ff` | 2.86:1 — as a *mark*, not as text | 2.64:1 |

  Two consequences you must act on: **never put a value the user has to read in `#8793a3` or lighter**, and note that sidebar section labels (`#8793a3` on the `#f5f5fa` canvas) are technically below the bar — they are acceptable only because they are redundant grouping labels, and if you add any *meaningful* small text to the sidebar it must be `#606a78` or darker.

- **Status badge text passes comfortably:** `#0a5c37`/`#d1fae5` = 7.12:1, `#8c1a20`/`#ffebec` = 8.03:1, `#7a4a00`/`#fbf5e0` = 6.85:1, `#122368`/`#ebf1ff` = 12.66:1.
- **Hairline borders** at `#d5d5e8` are 1.45:1 against white — decorative, not informational. Any information carried by a border must be duplicated in text or icon.
- **Focus** is a visible 2px ring with a white offset, on every interactive element, never removed.
- **Colour is never the only channel.** Status badges carry a word. Chart series carry a legend and, at ≤ 4 series, direct labels. Stock-level colours carry an icon.
- **Keyboard.** Full tab order through sidebar → tabs → toolbar → content. `⌘K` command palette. Table: arrow keys move the focused cell, `Space` toggles row selection, `Enter` opens the record.
- **Tables** get real `<table>` semantics with `<caption>` (visually hidden), `scope="col"`, and `aria-sort` on the sorted header.
- **Charts** get `role="img"` with a descriptive `aria-label`, plus a "View as table" toggle in the card's `⋯` menu. That toggle is not optional — it is the accessible equivalent of the chart.
- **Reduced motion** disables all transitions and chart animation.
- Minimum hit target `32×32px` (met by the standard control height); anything smaller gets an invisible padded hit area.

---

## 9. Do / Don't

| ✅ Do | ❌ Don't |
|---|---|
| Hairline `0.5px #d5d5e8` borders on cards | Put a drop shadow on a card |
| `#172131` for the darkest ink | Use `#000000` anywhere |
| Weight 400 → 500 only | Use 600/700 for emphasis |
| `rgba(57,70,91,.03)` wells to isolate values | Add a border *and* a fill to the same block |
| One filled primary button per screen | A toolbar of blue buttons |
| Dotted horizontal gridlines, no axis lines | Full grids, solid axes, visible tick marks |
| One blue + gradient for a single series | Rainbow a single-series chart |
| Assign chart colours in fixed order | Cycle or hash colours per render |
| Two charts for two scales | A dual-axis chart |
| Delta badges beside a neutral KPI number | Colour the KPI number red/green |
| Skeletons that preserve card height | Spinners that collapse the layout |
| 32px control height everywhere | Mixed 28/34/40px controls in one row |
| Radius 6/8/12/16 | Radius 4, 10, 14, 20 |
| Uppercase 12px nav group labels | Horizontal rules between nav groups |
| Grey pill + weight bump for active nav | A blue left accent bar |
| Tabular numerals in every numeric cell | Proportional figures in a money column |
| `—` in `#cacfd8` for unknown | `0` for unknown, or an empty cell |

---

## 10. QA checklist

Run this before calling any screen done.

**Structure**
- [ ] Canvas is `#f5f5fa`; exactly one white panel, `16px` radius, `0.5px` border, inset from the viewport
- [ ] Sidebar is `260px`, sits on the canvas, has no border
- [ ] Header / tabs / toolbar are fixed; only the content region scrolls
- [ ] Grid is 12 columns with a `16px` gutter; every card in a row is the same height

**Type & colour**
- [ ] No font weight above 500 anywhere
- [ ] Every text colour is one of the five ink tokens
- [ ] No pure black, no pure-saturated brand blue on text
- [ ] Numbers are tabular; currency, %, and durations follow §5.2 formatting

**Components**
- [ ] Every card: `0.5px` border, `16px` radius, `16/20/24` padding, `shadow: none`
- [ ] Every control is `32px` tall with an `8px` radius and a `16px` icon
- [ ] At most one filled primary button in view
- [ ] Focus ring visible on every interactive element
- [ ] Hover state defined for every clickable surface

**Charts**
- [ ] Gridlines horizontal + dotted `3 3` in `#d5d5e8`; no axis lines; no tick lines
- [ ] Single series → `#6895ff` + gradient, no legend
- [ ] ≥ 2 series → legend present; ≤ 4 series → also direct-labelled
- [ ] ≥ 4 series → ERP-safe palette, assigned in fixed order
- [ ] No dual-axis chart on the page
- [ ] Tooltip is the custom card, not the Recharts default
- [ ] "View as table" available in the card's `⋯` menu
- [ ] Palette re-validated if any colour was changed

**States**
- [ ] Loading = skeleton at the final height; no layout shift when data lands
- [ ] Empty state has an icon, a line, an explanation and one action
- [ ] Error state lives in the card, not in a toast
- [ ] Zero and unknown render differently

**Accessibility**
- [ ] No information carried by colour alone
- [ ] Keyboard path through the whole screen
- [ ] Table has semantic markup and `aria-sort`
- [ ] `prefers-reduced-motion` honoured

---

## 11. Appendix — complete measured token dump

These are raw computed values pulled from the live source, kept verbatim for reference. Where the body of this document simplifies a name, the original name is here.

**Layout classes observed**

```
body      flex h-full min-w-[1440px] overflow-x-auto antialiased
aside     flex h-full flex-none flex-col bg-bg-main transition-[width] duration-300 ease-in-out w-[260px] pr-4
panel     relative z-10 min-h-0 flex-1 rounded-radius-xxl border-[0.5px] border-border-default bg-bg-secondary p-4
scroller  flex h-full w-[calc(100%+1rem)] flex-col overflow-x-hidden rounded-md bg-bg-secondary
header    flex items-center justify-between py-2 pl-2 pr-6            (44px tall)
card      relative flex flex-col gap-6 rounded-2xl px-5 pb-6 pt-4 border-[0.5px] border-border-sub-500
          bg-comp-outline-default justify-between overflow-hidden h-full
cardBody  relative flex h-full flex-col gap-4 z-10
well      flex h-full flex-col items-center justify-center rounded-xl bg-chart-bg py-4
kpi       font-medium text-text-primary-950 text-[32px] tracking-[1.92px]
title     block truncate pr-[90px] text-base font-medium leading-6 tracking-tight text-text-primary-950
pageTitle text-xl font-medium leading-7 text-text-primary-950
navRow    flex items-center overflow-hidden rounded-lg gap-2 px-2 py-1.5 bg-sidebar-active-item text-sm font-medium
navLabel  text-sm font-normal leading-tight whitespace-nowrap text-text-secondary-600
groupLbl  text-xs font-medium uppercase text-text-sub-500
tab       -mb-px inline-flex h-10 items-center rounded-none border-b-[1.8px] border-transparent px-0
          text-sm font-normal text-text-placeholder whitespace-nowrap select-none transition-colors
tabLabel  block max-w-[360px] truncate rounded-md px-1 text-sm font-medium tracking-[-0.084px] hover:bg-fill-item-hover
button    inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors
          h-8 · radius 8px · border 0.5px #d5d5e8 · padding 0 8px · gap 8px
```

**Original token names → this document's names**

| Source variable | Value | Renamed to |
|---|---|---|
| `--bg-main` / `--bg-base` | `#f5f5fa` | `--bg-canvas` |
| `--bg-secondary` / `--bg-card` / `--bg-body` / `--bg-float` | `#ffffff` | `--bg-surface` |
| `--chart-bg` / `--bg-body-overlay` | `rgba(57,70,91,0.03)` | `--bg-well` |
| `--bg-icon` / `--sidebar-active-item` | `rgba(57,70,91,0.05)` | `--bg-item-active` |
| `--fill-hover` | `#f5f5fa` | `--bg-item-hover` |
| `--border-default` / `--border-sub-500` / `--border-focus` | `#d5d5e8` | `--border-default` |
| `--border-hover` / `--border-secondary-600` | `#bdbdd6` | `--border-hover` |
| `--border-divider` | `rgba(57,70,91,0.15)` | `--border-divider` |
| `--border-soft-300` / `--border-disabled` | `rgba(0,0,0,0.05)` | `--border-soft` |
| `--border-selected` | `#172131` | `--border-selected` |
| `--text-primary` / `--text-primary-950` / `--icon-primary` | `#172131` | `--text-primary` |
| `--text-secondary` / `--text-secondary-600` / `--icon-secondary` | `#606a78` | `--text-secondary` |
| `--text-sub-500` / `--text-placeholder` / `--icon-placeholder` | `#8793a3` | `--text-sub` |
| `--text-soft-400` | `#99a0ae` | `--text-soft` |
| `--text-disabled-300` | `#cacfd8` | `--text-disabled` |
| `--icon-disable-300` | `#c3ccd9` | — |
| `--text-warning` | `#ff8800` | `--warning` |
| `--state-error-base` / `--bg-error-base` | `#fb3748` | `--error` |
| `--border-destructive` | `#f54a45` | `--error-border` |
| `--state-error-lighter` / `--error-lighter` | `#ffebec` | `--error-bg` |
| `--bg-success-base` | `#1fc16b` | `--success` |
| `--bg-green-100` | `#d1fae5` | `--success-bg` |
| `--bg-information-lighter` | `#ebf1ff` | `--info-bg` |
| `--information-dark` | `#122368` | `--info-dark` |
| `--bg-yellow-200` / `--bg-sms` | `#fbf5e0` | `--warning-bg` |
| `--icon-yellow` | `#eab308` | — |
| `--comp-tooltip` | `#222331` | `--bg-tooltip` |
| `--bg-surface-800` | `#222530` | `--bg-inverted` |
| `--bg-mask` / `--bg-overlay` | `rgba(0,0,0,0.4)` | `--bg-scrim` |
| `--border-on-accent` | `#2b3854` | primary button hover |
| `--radius-md` | `8px` | `--radius-md` |
| `--radius-xxl` | `16px` | `--radius-xl` |
| `--shadow-s1 … --shadow-s5` | see §2.4 | unchanged |
| `--chart-color-1 … 12` | see §6.2 | `--chart-1 … 12` |
| series stroke (measured on `.recharts-line-curve`) | `#6895FF` | `--chart-primary` |
| area gradient | `20% #6895FF @.25 → 100% #6895FF @.05` | unchanged |
| grid | `stroke var(--border-sub-500)`, `dasharray 3 3` | unchanged |
| axis tick | `#737373`, `12px`, `400` | `--chart-axis` |

---

*Measured from the live DOM of the Retell AI analytics dashboard. Palette validation performed with an OKLab colour-vision simulator (protan/deutan/tritan ΔE, WCAG contrast, OKLCH lightness band and chroma floor).*
