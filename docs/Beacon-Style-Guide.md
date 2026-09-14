# Beacon — Style Guide

Version 1.0
Platform: Beacon, Spagad Technologies' Operations Management System
Companion to: Beacon SRS v1.4, Beacon Technical Design v1.1

This is the visual identity and UI convention reference for Beacon. It exists so every screen Cursor builds looks like it belongs to the same product, instead of defaulting to shadcn's generic gray theme.

---

## 1. Concept

Beacon signals facility status at a glance and tells operations teams where to look next. The visual language should feel like a calm, trustworthy control room: clear status signaling, high legibility for dense data, and restraint everywhere color isn't carrying meaning.

---

## 2. Color

### Core palette

| Token | Hex | Use |
|---|---|---|
| `ink` | `#1C2430` | Primary text |
| `slate` | `#5B6472` | Secondary text, muted labels, borders on dark elements |
| `hairline` | `#E3E1D9` | Card and section borders |
| `surface` | `#F4F5F3` | Page background |
| `surface-raised` | `#FFFFFF` | Cards, panels, table rows |
| `brand` | `#1F6F78` | Primary accent — links, primary buttons, active nav, focus rings |

### Facility health / status colors

These map directly to the rules in SRS section 7.2 and must be used consistently everywhere a status appears (dashboard, facility list, facility detail, notifications) — never substituted with ad hoc colors.

| Status | Background | Text | Hex (text) |
|---|---|---|---|
| Healthy | `#E9F2EC` | Dark green | `#1D6B45` |
| Attention Required | `#FBEFE3` | Dark amber | `#854F0B` |
| At Risk | `#FBE7DD` | Dark burnt orange | `#8A3A16` |
| Critical | `#FBE9E9` | Dark red | `#791F1F` |
| Inactive | `#EEEEEC` | Slate | `#5B6472` |

Rendered as pill badges: background tint + dark text from the same family, 12px font, medium weight, `border-radius: 20px`, `padding: 3px 10px`. Never plain black text on a colored badge.

### Usage rules

- `brand` teal is reserved for interactive/brand elements — never repurpose it as a status color, and never use a status color for a button or link.
- One accent per screen: don't let `brand` and a status color compete for attention in the same component.
- Text on any colored background always uses the darkest shade from that same color family (see table above), never plain black or generic gray.

---

## 3. Typography

| Role | Typeface | Weight | Use |
|---|---|---|---|
| Headings, dashboard metrics | Space Grotesk | 600 | Page titles, section headings, big numbers on metric cards |
| Body, UI text, forms, tables | IBM Plex Sans | 400 / 500 | Everything else — the default text face |
| IDs, codes, timestamps | IBM Plex Mono | 400 | Facility IDs, reference codes — used sparingly, never for prose |

Type scale (desktop):

| Level | Size | Weight | Face |
|---|---|---|---|
| Page title | 24px | 600 | Space Grotesk |
| Section heading | 18px | 600 | Space Grotesk |
| Metric number | 22px | 600 | Space Grotesk |
| Body | 14px | 400 | IBM Plex Sans |
| Secondary/muted text | 12–13px | 400 | IBM Plex Sans, `slate` |
| Table header | 12px | 500 | IBM Plex Sans, `slate`, sentence case (never all caps) |
| Code/ID | 12–13px | 400 | IBM Plex Mono |

Sentence case throughout — no title case, no all-caps labels, matching the writing conventions in Technical Design section 6 (API naming) and general product copy.

---

## 4. Logo Mark

A simple radar/pulse mark: a solid dot with two concentric arcs radiating outward, in `brand` teal, paired with the "Beacon" wordmark set in Space Grotesk 600.

```
●)) Beacon
```

- Mark alone (favicon, collapsed nav): the dot + arcs only, no wordmark.
- Full lockup (top bar, login screen, exported report headers): mark + wordmark, mark on the left.
- Minimum clear space: the mark's own width on all sides.
- Do not recolor the mark per status — it always renders in `brand` teal regardless of context.

---

## 5. Layout Conventions

- Left rail navigation (Facilities, Incidents, Actions, Reports, QA, Handovers, Calendar, Analytics, Admin) + top bar (logo, search, notifications, avatar).
- Left-aligned content throughout — this is a data-dense operational tool, not marketing copy; avoid centered text blocks.
- Cards: `surface-raised` background, `0.5px solid hairline` border, `12px` corner radius, no drop shadows.
- Dense list rows (facility lists, incident lists) use bordered rows rather than individually shadowed cards — reserve card treatment for dashboard summaries and the facility detail overview.
- Metric cards: muted 12–13px label above a 22px/600 number, grouped in rows of 2–4 with consistent gaps.

---

## 6. Components

- **Status pill**: see section 2. Used identically across dashboard, list, and detail views.
- **Primary button**: `brand` fill, white text, one per view maximum.
- **Secondary button**: transparent fill, `hairline` border, `ink` text.
- **Table**: `slate` sentence-case headers, `hairline` row dividers, no zebra striping.
- **Empty states**: name the space and give a clear next action (e.g. "No incidents yet — report one to get started"), never just "Nothing here."

---

## 7. Reference Preview

A sample dashboard fragment (metric cards + facility list with status pills) was reviewed and approved as the visual direction for Beacon during design sign-off.
