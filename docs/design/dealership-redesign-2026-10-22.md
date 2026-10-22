# Dealership redesign: direction (2026-10-22)

## Storefront: "Showroom floor"
- **Fonts:** Archivo (variable, `wdth` 108–116) for display and headings (`.sf-display`, `.sf-heading`, `.sf-price`); Instrument Sans for body; Geist Mono for readouts (`.sf-figure`, `.sf-eyebrow`, `.sf-label`): prices, mileage, stock #, VIN, hours, counts.
- **Palette:** cool showroom white `--sf-paper`, concrete `--sf-paper-2`, tarmac `--sf-paper-3` (dark bands: `.sf-band`, used by the header strip, home hero and footer). Ink `--sf-ink`, `--sf-ink-2`, `--sf-ink-3`. The accent `--sf-accent` follows the merchant's logo hue from Store Settings. Status tones are `--sf-ok`, `--sf-warn`, `--sf-bad` and `--sf-idle`.
- **Radii:** 8px fields, 14px photos and cards, 22px floating consoles. Buttons and pills are fully round.
- **Signature:** the window sticker (`.sf-sticker`, `.sf-sticker-head`, `.sf-sticker-row`) is the VDP price panel and the review step of each request form. The spec strip (`.sf-spec`) gives hairline-divided readouts.
- **Rules:**
  - Segmented choices, tabs and in-page button groups are `.sf-track` holding `.sf-pill`. A selected pill uses `aria-pressed="true"` or `data-active="true"`; `.sf-pill-raised` is a raised action and `.sf-pill-primary` is the main action.
  - Standalone submit buttons are `.sf-btn .sf-btn-primary`.
  - Status dots are `.sf-dot[data-tone]` inside `.sf-title-line`, on the title line.
  - Copy is labels, states and errors only. Icons come from lucide. Use `ArrowUpRight` for external links. No Unicode arrows or emoji.
  - Phone first, with 44px targets and no horizontal scroll.
- **Layout:**
  - `Container` is 78rem wide. `PageHeader` takes `eyebrow`, `title`, an optional `description`, `actions` and `tone` (light or dark).
  - Sections use `.sf-section` and are separated by spacing and hairlines. Avoid boxes inside boxes.
  - `.sf-well` is a recessed surface for empty states and readouts. `.sf-notice[data-tone]` shows form results and errors.

## Platform: "Desk"
- Built on the dashboard tokens (`bg-background`, `bg-card`, `bg-muted`, `text-muted-foreground`, `border`), so light and dark both work. The kit is `features/platform/components/desk.tsx`:
  - `DeskHeader`: goes in PageContainer's `header` slot. It takes a title with a status dot on the title line, a meta line and actions.
  - `Track` with `Pill` (raised pill in a recessed track): every in-page button group. Use `variant="primary"` for the main action, `raised` for secondary actions, and `active` for segmented choices.
  - `Segmented`: status and filter tabs, with counts.
  - `ReadoutStrip` with `Readout`: headline figures.
  - `DeskSection`: a titled region with a hairline, not a card.
  - `Panel`: a bordered list surface. Use `divide-y` rows.
  - `TitleLine`: puts the status dot on the title line.
  - `Facts`: label/value list. `Notice`: errors and results. `Code`: stock #, VIN, RO #. `Meter`: segmented share from real data.
- Use shadcn `Dialog`, `Sheet`, `Select`, `Input` and `Textarea` for forms. A dialog footer's buttons sit in a `Track`.
- Lists become row lists: the status dot and the title share a line, and the subline is muted. Figures are right-aligned with tabular numbers.
- `PageContainer` and everything under `features/dashboard/**` are shared and must not change.
