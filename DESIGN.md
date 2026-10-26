---
name: Openfront Dealership
description: Grease-pencil windshield numbers on the operator desk; the rooftop's own wayfinding signage, in daylight, on the storefront.
colors:
  desk-ground: "oklch(1 0 0)"
  desk-ink: "oklch(0.141 0.005 285.823)"
  desk-muted: "oklch(0.967 0.001 286.375)"
  desk-muted-ink: "oklch(0.552 0.016 285.938)"
  desk-hairline: "oklch(0.92 0.004 286.32)"
  lot-yellow: "oklch(0.9 0.17 95)"
  lot-yellow-soft: "oklch(0.93 0.13 95)"
  lot-yellow-night: "oklch(0.84 0.16 92)"
  desk-ok: "oklch(0.596 0.145 163.225)"
  desk-warn: "oklch(0.555 0.163 48.998)"
  desk-bad: "oklch(0.577 0.245 27.325)"
  desk-info: "oklch(0.588 0.158 241.966)"
  desk-idle: "oklch(0.705 0.015 286.067)"
  sf-sign: "oklch(0.38 0.13 262)"
  sf-sign-2: "oklch(0.32 0.115 262)"
  sf-accent: "oklch(0.45 0.15 262)"
  sf-accent-hover: "oklch(0.38 0.13 262)"
  sf-accent-soft: "oklch(0.94 0.03 262)"
  sf-focus: "oklch(0.55 0.18 262)"
  sf-on-dark: "oklch(0.99 0.004 250)"
  sf-on-dark-2: "oklch(0.88 0.03 262)"
  sf-lane: "oklch(0.87 0.165 95)"
  sf-asphalt: "oklch(0.24 0.008 262)"
  sf-paper: "oklch(0.995 0.001 250)"
  sf-paper-2: "oklch(0.962 0.004 250)"
  sf-paper-3: "oklch(0.935 0.005 250)"
  sf-paper-4: "oklch(0.9 0.006 250)"
  sf-ink: "oklch(0.2 0.012 262)"
  sf-ink-2: "oklch(0.4 0.012 262)"
  sf-ink-3: "oklch(0.52 0.01 262)"
  sf-rule: "oklch(0.875 0.006 250)"
  sf-ok: "oklch(0.52 0.13 152)"
  sf-warn: "oklch(0.62 0.14 70)"
  sf-bad: "oklch(0.53 0.19 27)"
  sf-idle: "oklch(0.6 0.01 262)"
typography:
  desk-page-title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.33
    letterSpacing: "-0.015em"
  desk-section-title:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.43
  desk-body:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  desk-label:
    fontFamily: "Geist, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.33
  desk-code:
    fontFamily: "Geist Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    letterSpacing: "-0.025em"
    fontFeature: "tnum"
  desk-figure:
    fontFamily: "Archivo, sans-serif"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
    fontVariation: "wdth 72"
  desk-figure-windshield:
    fontFamily: "Archivo, sans-serif"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
    fontVariation: "wdth 72"
  sf-display:
    fontFamily: "Overpass, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(2.5rem, 6vw, 4.5rem)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.025em"
  sf-headline:
    fontFamily: "Overpass, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(1.75rem, 3vw, 2.25rem)"
    fontWeight: 800
    lineHeight: 0.95
    letterSpacing: "-0.025em"
  sf-title:
    fontFamily: "Overpass, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  sf-title-sm:
    fontFamily: "Overpass, Helvetica Neue, Arial, sans-serif"
    fontSize: "1.1875rem"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  sf-price:
    fontFamily: "Overpass, Helvetica Neue, Arial, sans-serif"
    fontSize: "clamp(1.75rem, 3vw, 2.25rem)"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "tnum"
  sf-body:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  sf-label:
    fontFamily: "Public Sans, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 600
    letterSpacing: "0"
  sf-figure:
    fontFamily: "Overpass Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 400
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
rounded:
  desk-mark: "1px"
  desk-marker: "2px"
  desk-control: "4px"
  desk-panel: "6px"
  sf-mark: "1px"
  sf-stall: "2px"
  sf-sm: "3px"
  sf-md: "4px"
spacing:
  desk-cell-x: "12px"
  desk-cell-y: "10px"
  desk-row-edge: "16px"
  sf-3xs: "0.25rem"
  sf-2xs: "0.5rem"
  sf-xs: "0.75rem"
  sf-sm: "1rem"
  sf-md: "1.5rem"
  sf-lg: "2rem"
  sf-xl: "3rem"
  sf-2xl: "4.5rem"
  sf-3xl: "7rem"
components:
  desk-button-primary:
    backgroundColor: "{colors.desk-ink}"
    textColor: "{colors.desk-ground}"
    typography: "{typography.desk-body}"
    rounded: "{rounded.desk-control}"
    padding: "0 12px"
    height: "32px"
  desk-button-raised:
    backgroundColor: "{colors.desk-ground}"
    textColor: "{colors.desk-ink}"
    typography: "{typography.desk-body}"
    rounded: "{rounded.desk-control}"
    padding: "0 12px"
    height: "32px"
  desk-button-raised-hover:
    backgroundColor: "{colors.desk-muted}"
  desk-button-plain:
    textColor: "{colors.desk-muted-ink}"
    typography: "{typography.desk-body}"
    rounded: "{rounded.desk-control}"
    padding: "0 12px"
    height: "32px"
  desk-button-danger:
    backgroundColor: "{colors.desk-bad}"
    textColor: "{colors.desk-ground}"
    rounded: "{rounded.desk-control}"
    height: "32px"
  desk-tab:
    textColor: "{colors.desk-muted-ink}"
    typography: "{typography.desk-body}"
    padding: "0 12px"
    height: "36px"
  desk-tab-active:
    textColor: "{colors.desk-ink}"
  desk-panel:
    backgroundColor: "{colors.desk-ground}"
    rounded: "{rounded.desk-panel}"
  desk-table-header:
    backgroundColor: "{colors.desk-muted}"
    textColor: "{colors.desk-muted-ink}"
    typography: "{typography.desk-label}"
    height: "36px"
    padding: "0 12px"
  desk-table-cell:
    typography: "{typography.desk-body}"
    padding: "10px 12px"
  desk-attention:
    backgroundColor: "{colors.lot-yellow-soft}"
    textColor: "{colors.desk-ink}"
    rounded: "{rounded.desk-marker}"
    padding: "1px 6px"
  desk-figure-attention:
    backgroundColor: "{colors.lot-yellow}"
    textColor: "{colors.desk-ink}"
    typography: "{typography.desk-figure}"
    rounded: "{rounded.desk-marker}"
    padding: "0 4px"
  sf-button-primary:
    backgroundColor: "{colors.sf-accent}"
    textColor: "{colors.sf-on-dark}"
    rounded: "{rounded.sf-sm}"
    padding: "0.65rem 1.2rem"
    height: "2.75rem"
  sf-button-primary-hover:
    backgroundColor: "{colors.sf-accent-hover}"
  sf-button-secondary:
    backgroundColor: "{colors.sf-ink}"
    textColor: "{colors.sf-paper}"
    rounded: "{rounded.sf-sm}"
    padding: "0.65rem 1.2rem"
    height: "2.75rem"
  sf-button-ghost:
    backgroundColor: "{colors.sf-paper}"
    textColor: "{colors.sf-ink}"
    rounded: "{rounded.sf-sm}"
    padding: "0.65rem 1.2rem"
    height: "2.75rem"
  sf-button-on-sign:
    backgroundColor: "{colors.sf-paper}"
    textColor: "{colors.sf-sign}"
    rounded: "{rounded.sf-sm}"
  sf-segment:
    textColor: "{colors.sf-ink}"
    padding: "0.4rem 0.95rem"
    height: "2.5rem"
  sf-segment-active:
    backgroundColor: "{colors.sf-ink}"
    textColor: "{colors.sf-paper}"
  sf-input:
    backgroundColor: "{colors.sf-paper}"
    textColor: "{colors.sf-ink}"
    typography: "{typography.sf-body}"
    rounded: "{rounded.sf-sm}"
    padding: "0.65rem 0.85rem"
    height: "2.75rem"
  sf-card:
    backgroundColor: "{colors.sf-paper}"
    rounded: "{rounded.sf-md}"
  sf-sign:
    backgroundColor: "{colors.sf-sign}"
    textColor: "{colors.sf-on-dark}"
    rounded: "{rounded.sf-md}"
  sf-stall:
    backgroundColor: "{colors.sf-asphalt}"
    textColor: "{colors.sf-lane}"
    rounded: "{rounded.sf-stall}"
    padding: "0.2rem 0.5rem 0.15rem"
  sf-chip:
    backgroundColor: "{colors.sf-paper}"
    textColor: "{colors.sf-ink}"
    rounded: "{rounded.sf-stall}"
    padding: "0.2rem 0.5rem"
---

# Design System: Openfront Dealership

## Overview

**Creative North Star: "The Lot, Marked and Signed"**

Openfront Dealership carries two worlds that share one premise: a car lot is already a designed place. Inside the operator dashboard, the world is **the lot's windshield numbers**: a dealership writes price, stock and days on the glass in grease pencil and circles the units that need attention. Every desk page leads with the queue of units or people that need the operator now, with the one number each row is about set condensed and heavy, and a single lot-yellow marker on whatever has gone stale. Density is high, surfaces are flat, and state is always spoken as a word beside a small square mark.

On the storefront, the world is **the rooftop's own wayfinding signage in daylight**: the enamel pylon and directory sign (Sales, Service, Parts) in the merchant's logo hue, white panels on cool concrete, and the painted stall number on every space. The home page is that directory sign, and each row is a working door; the Sales row is the live inventory search. Vehicles are named and numbered in one breath (title plus stall number), and quantities (price, miles, monthly estimate) are set as figures, not prose.

Scope: the shared Openfront dashboard shell (sidebar, breadcrumbs, PageContainer) is fixed and byte-identical to Openfront E-commerce, so it is out of scope for this system. The desk world consumes the shell's neutral tokens (white ground, zinc hairlines, carbon ink) but never restyles them. Both worlds share a hard brand commitment from the owner: no pill-shaped or heavily rounded tabs, chips or cards anywhere.

**Key Characteristics:**
- Desk: shell neutrals, carbon ink, one lot-yellow marker reserved for attention.
- Desk: condensed Archivo figures for the number a row is about; Geist for everything else on a held five-size ramp.
- Desk: 4px controls, 6px panels, underline tabs, hairline tables with sticky headers.
- Storefront: enamel sign face in the rooftop's logo hue carrying white Overpass at heavy weight.
- Storefront: lane yellow on asphalt only for stall numbers and the service lane.
- Storefront: 3px controls, 4px photos and panels; joined square segmented controls with an ink-filled current choice.
- Both: a status is a small square mark plus its word; colour is never the only signal.

## Colors

The desk is near-monochrome with one attention colour; the storefront is cool concrete and white panels under a single enamel sign hue, with lane paint as the only warm note.

### Primary
- **Enamel Sign Face** (sf-sign): the storefront's directory sign, header utility strip, footer and dark page headers. The hue is not fixed: it is `262 + logo hue` from Store Settings, so every rooftop's signage is in its own colour. The frontmatter records the default (hue 262, the library mark's blue).
- **Sign Accent** (sf-accent, hover sf-accent-hover): primary buttons, the active nav underline, link hover, the saved-vehicles count badge. Same rotating hue, one step lighter than the sign face.
- **Carbon Ink** (desk-ink): the desk's only "brand" colour. Primary buttons are ink-filled; the current underline tab is ink.

### Secondary
- **Lot Yellow** (lot-yellow on figures, lot-yellow-soft on word markers, lot-yellow-night in dark mode): the grease-pencil mark. It appears only on a figure or word that needs attention (aged unit, overdue task, waiting customer), behind near-black text.
- **Lane Paint** (sf-lane on sf-asphalt): stall numbers on vehicle photos, the dashed stripe along the service lane, and text selection. Nowhere else.

### Neutral
- **Desk Ground / Muted / Hairline / Muted Ink** (desk-ground, desk-muted, desk-hairline, desk-muted-ink): inherited from the shared shell. Ground for panels and tables, muted for table headers and hover rows, hairline for every border, muted ink for labels, counts and meta.
- **Concrete** (sf-paper-2): the storefront page ground. **Panel White** (sf-paper) for cards, wells, inputs and the window sticker. **sf-paper-3 / sf-paper-4** for photo placeholders and skeletons.
- **Sign Ink** (sf-ink, sf-ink-2, sf-ink-3): body text, secondary text, faint labels and input borders. **Rule** (sf-rule) for every hairline on the storefront.
- **On-Sign White** (sf-on-dark, sf-on-dark-2): type on the enamel face; the second step carries secondary text and labels on the sign.

### Status
- **Desk tones** (desk-ok, desk-warn, desk-bad, desk-info, desk-idle): status marks only, with text in the next darker step of the same hue. **Storefront tones** (sf-ok, sf-warn, sf-bad, sf-idle): availability marks and notices.

### Named Rules
**The Grease Pencil Rule.** Lot yellow marks attention and nothing else: aged, overdue, waiting. It never decorates a heading, a button or a chart.

**The Mark-and-Word Rule.** Every status is a small square mark (1px corners) paired with its word on the same row. Colour alone never carries state, on either surface.

**The Rooftop's Own Colour Rule.** Storefront sign and accent colours are derived from the merchant's logo hue; never hard-code a brand hue on the storefront.

**The Lane Paint Rule.** Lane yellow appears only as painted lot markings: stall numbers and the service-lane stripe.

## Typography

**Desk Display/Figure Font:** Archivo, width axis at 72%, weight 700, tabular figures
**Desk Body Font:** Geist (the shell's sans), with Geist Mono for identifiers
**Storefront Display Font:** Overpass (Highway Gothic lineage), with Helvetica Neue, Arial
**Storefront Body Font:** Public Sans, with system-ui
**Storefront Mono Font:** Overpass Mono

**Character:** On the desk, a quiet grotesque does all the reading and a condensed heavy face sets only the numbers, so figures read like grease pencil on glass. On the storefront, road-sign lettering at heavy weights carries names, prices and headings, and a plain civic sans reads the small print.

### Hierarchy
- **Desk page title** (Geist 600, 24px, -0.015em): the DeskHeader title, one per page.
- **Desk figure** (Archivo 700 condensed, 14 / 20 / 24px): the one number a row, readout or summary is about.
- **Windshield figure** (Archivo 700 condensed, 32px, 40px from sm): the signature figures on a vehicle record (price, stock, days on lot).
- **Desk section title** (Geist 600, 14px): DeskSection headings, with the count beside it at 13px regular.
- **Desk body** (Geist 400/500, 13px): table cells, facts lists, notices, buttons, tabs.
- **Desk label** (Geist 500, 12px): table headers, readout labels, counts in tabs, sub-lines. Sentence case.
- **Desk code** (Geist Mono, 12px, tabular): stock numbers, VINs, RO numbers.
- **Storefront display** (Overpass 800, clamp(2.5rem, 6vw, 4.5rem), 0.95, balanced): page titles and the dealership name on the sign.
- **Storefront headline** (Overpass 800, clamp(1.75rem, 3vw, 2.25rem)): section titles such as "On the lot"; the same size sets the lead and list prices.
- **Storefront title** (Overpass 700, 1.5rem / 1.1875rem, 1.15): sign rows, vehicle names, footer name.
- **Storefront body** (Public Sans 400, 1rem, 1.5): running text; descriptions held to max-w-xl.
- **Storefront label** (Public Sans 600, 0.8125rem, sentence case): field labels, table headers, footer column labels, value labels.
- **Storefront figure** (Overpass Mono, tabular): mileage, stock, phone number, hours, counts.

### Named Rules
**The Held Ramp Rule.** Desk text uses five sizes (12, 13, 14, 20, 24px), with Archivo figures at 14/20/24 and the windshield at 32/40. No ad-hoc sizes, no tracking beyond the title's -0.015em.

**The No Tracked Caps Rule.** Small labels on both surfaces are sentence case with zero letter-spacing. Uppercase is reserved for data that is uppercase by nature (VINs, part numbers, codes) in mono.

**The Figures Are the Interface Rule.** Price, miles, stock and payment estimates are set as figures (Archivo on the desk; Overpass 800 or Overpass Mono on the storefront), never buried in a sentence.

## Layout

**Desk.** Pages sit inside the shell's PageContainer. The first viewport is title left with one primary action right (utilities as plain ghost buttons), then the "Needs you" attention queue as a dense table or list ordered oldest or most urgent first, then underline status tabs and search above the full table. Summary figures are demoted to one borderless hairline strip (ReadoutStrip): two up on phones, auto-fit columns of at least 8rem from md, divided by hairlines rather than boxes. Sections are separated by spacing and a hairline under the title (ink at 15%), not by cards. Table cells pad 10px by 12px, with 16px at the row's first and last cells. Columns carry a priority: priority 2 drops below md (768px), priority 3 below lg (1024px). Tab rows scroll sideways behind an edge fade rather than wrapping.

**Storefront.** Content sits in a centred container `min(78rem, 100% - 2rem)`, widening the gutter to 3rem from 768px. Vertical rhythm comes from the sf-space scale: sections pad sf-xl (3rem), growing to sf-2xl (4.5rem) from md. The home first viewport is a 5:7 grid from lg, with the directory sign on the left and the lead car photo (stall number and price) on the right; on phones the sign and its search come first and the lead car follows. Inventory grids run one, two, then three columns with 1.5rem column and 2.5rem row gaps. The header is a sticky white strip (64px, 72px from md) under an enamel utility strip showing address, hours and phone (from sm). The full nav appears from xl (1280px); below that a menu sheet drops down.

## Elevation & Depth

Both worlds are flat. Depth comes from hairlines, tonal grounds (concrete under white panels; muted header rows over white tables) and the enamel sign face, not from shadows. The desk adds no shadows of its own: inputs explicitly drop the shell's shadow, and sticky table headers use a translucent muted ground with a small backdrop blur. The storefront keeps three shadows, all quiet.

### Shadow Vocabulary
- **Raised** (`box-shadow: 0 1px 0 oklch(0.2 0.012 262 / 0.06)`): a single-pixel ground line under raised plates.
- **Recessed** (`box-shadow: inset 0 0 0 1px var(--sf-rule)`): an inset hairline for wells.
- **Float** (`box-shadow: 0 18px 40px -24px oklch(0.2 0.012 262 / 0.35), 0 0 0 1px var(--sf-rule)`): the mobile menu sheet only, the one layer that floats over content.
- **Focus halo** (`box-shadow: 0 0 0 3px oklch(0.55 0.18 hue / 0.18)`): storefront inputs on focus, with the border turning to the accent.

### Named Rules
**The Hairline Not Box Rule.** Group with a hairline and spacing first; reach for a bordered panel only for lists, tables and forms. Never stack cards to make a summary.

## Shapes

Small, consistent corners on everything. Desk: status marks 1px, lot-yellow markers and the meter 1–2px, every control (buttons, inputs, notices) 4px, panels and table frames 6px. Storefront: status marks 1px, stall numbers and chips 2px, buttons, inputs, tracks and notices 3px, cards, panels, photos, the directory sign and the lead frame 4px. Nothing is a pill. Segmented choices are square-cornered segments: underline tabs on the desk (2px ink underline on the current tab) and a joined plate row on the storefront, with a 1px ink border, ink dividers between segments and the current one ink-filled. The window sticker is the one heavier outline: a 1.5px ink border with an ink header bar.

**The Small Corners Rule.** No radius above 6px on the desk or 4px on the storefront. A rounded-full shape is never acceptable for a tab, chip, badge or card.

## Components

### Buttons
Desk buttons are flat and square (4px), 32px tall (28px small), 13px medium weight.
- **Primary:** ink-filled with white text; hover drops to 85% ink. One per page header.
- **Raised (default):** white with a 1px input-colour border; hover fills muted.
- **Plain:** ghost, muted text, muted fill on hover. Used for header utilities.
- **Danger:** red-600 fill, white text, red-700 on hover.
- **Focus:** a 2px ring in the shell's ring colour, offset 1px. Disabled at 50% opacity. Colour transitions take 150ms.

Storefront buttons are sign plates: Overpass 700 at 0.875rem, 3px corners, a minimum height of 44px (36px small, 0.75rem text).
- **Primary:** sign accent with white text; hover moves to the deeper accent.
- **Secondary:** ink with white text; hover moves to ink-2.
- **Ghost:** white with a 1px ink border; hover fills concrete.
- **On the sign face:** primary inverts to white with sign-coloured text, and ghost turns transparent with a translucent white border.
- **Focus:** a 2px outline in sf-focus, offset 2px. Transitions take 160ms on the expo-out curve.

### Segmented controls and tabs
- **Desk (Segmented / StatusTabs):** underline tabs on a hairline. Inactive tabs are muted, and the current tab gets an ink text colour plus a 2px ink underline. A count sits beside each label at 12px tabular (70% ink when non-zero), and a 6px status mark goes before the label when the tab has a tone.
- **Storefront (track + segment):** a joined row of square Overpass 700 plates with a 1px ink frame and ink dividers. The current choice is ink-filled with white text, and its count turns light. On the sign face the frame becomes translucent white and the current choice is white with sign-coloured text.

### Chips
- **Storefront chip:** a small white plate (2px corners, 0.75rem Overpass 700, hairline border). It carries vehicle condition and "Representative photo" on photos. It is never a pill.
- **Desk:** there are no chips. The desk uses status cells (mark plus word) and lot-yellow markers.

### Cards / Containers
- **Desk Panel / DeskTable frame:** white ground, 1px hairline border, 6px corners, no shadow, no internal padding (contents pad themselves).
- **Storefront card, panel and well:** white on concrete, 1px rule border, 4px corners, padding from the sf-space scale (often 1.5rem).
- **Window sticker:** the printed price-and-spec label. White, with a 1.5px ink border, 3px corners and an ink header bar in Overpass 700. Rows are hairline-divided, and values are right-aligned in Overpass Mono.

### Inputs / Fields
- **Desk:** the shell input at 40px (44px on phones for touch), 4px corners, 13px text, shadow removed. Identifiers are set in uppercase mono.
- **Storefront:** white, with a 1px ink-3 border, 3px corners and a 44px minimum height. Text is 1rem on phones (no zoom) and 0.875rem from md. Hover turns the border ink. Focus turns the border accent and adds a 3px accent halo at 18% opacity. Invalid fields get an sf-bad border, with a 0.75rem error line below. Selects carry an inline chevron.

### Navigation
- **Storefront header:** a white strip with the logo and dealership name in Overpass 700. Nav links are Public Sans 600 at 0.875rem, ink-2 at rest and ink when active, with a 3px accent bar under the active link sitting on the header's bottom hairline. Icon buttons are 44px squares with 3px corners and a concrete hover. The mobile menu lists Overpass 700 rows at 1.1875rem with hairline separators, and the active row turns accent.
- **Desk:** navigation is the shared shell's (out of scope). In-page back links ride the header meta line.

### Tables (desk signature)
Dense 13px tables inside a 6px hairline frame. Headers are sticky 36px rows on a translucent muted ground with backdrop blur, set at 12px medium muted. Rows are hairline-separated, take a 40% muted hover, and the whole row opens its record. Right-aligned columns use tabular figures. Lower-priority columns drop at narrow widths.

### Status cell, attention marker and figure (desk signature)
- **Status:** an 8px square mark with 1px corners, then the word at 13px medium in the tone's text colour.
- **Attention:** a lot-yellow-soft plate (2px corners, 12px semibold, near-black text) beside a word such as "Overdue" or "42 days".
- **Figure:** Archivo 700 condensed, tabular, line-height 1. With `attention` it sits on a lot-yellow plate with 4px side padding.
- **Windshield:** a row of 32–40px figures over 12px labels, closed by an ink-15% hairline. It appears on the vehicle record.

### Directory sign (storefront signature)
The home page's enamel sign: the dealership name in display type, then a Sales row holding the live search (make, model, year, price, Search) and a lot count in mono, then door rows (Service, Trade-in, Financing). Door rows are at least 60px tall, separated by translucent white hairlines, with an Overpass 700 label, a secondary line in on-dark-2, and an arrow that moves 4px right on hover over 240ms.

### Stall number (storefront signature)
`#STOCK` in Overpass Mono 600 at 0.75rem with 0.02em spacing, in lane yellow on an asphalt plate with 2px corners. It sits on every vehicle photo, bottom left.

### Service lane (storefront signature)
An asphalt band with white text and a 6px dashed lane-yellow stripe along the bottom (3rem dashes, 1.5rem gaps). It is used for the service page header.

## Do's and Don'ts

### Do:
- **Do** lead every desk page with the queue that needs the operator now, oldest or most urgent first, and put the full table below it.
- **Do** pair every status mark with its word, on both surfaces.
- **Do** set the one number a row is about as an Archivo condensed figure, and reserve lot yellow for figures or words that need attention.
- **Do** keep desk text on the 12/13/14/20/24px ramp, with figures at 14/20/24 and the windshield at 32/40.
- **Do** derive storefront sign and accent colours from `--sf-brand-hue`, so each rooftop's signage is its own colour.
- **Do** name and number a vehicle in one breath: a title with its stall number, and price and miles as figures.
- **Do** keep storefront touch targets at 44px minimum (2.75rem buttons and inputs, 44px icon buttons).
- **Do** keep photo credits visible on every licensed vehicle photo.

### Don't:
- **Don't** use pill-shaped or heavily rounded tabs, chips, badges or cards: no radius above 6px on the desk or 4px on the storefront.
- **Don't** open a desk page with a row of KPI cards. Summary figures go in one quiet hairline strip below the work.
- **Don't** use lot yellow or lane yellow as decoration, on headings, or on buttons.
- **Don't** set small labels in tracked uppercase, and don't put a small label above a heading as a kicker.
- **Don't** add shadows to desk surfaces, or shadows beyond the three quiet storefront shadows.
- **Don't** restyle the shared dashboard shell (sidebar, breadcrumbs, PageContainer). It is byte-identical to Openfront E-commerce.
- **Don't** hard-code a brand hue on the storefront.
