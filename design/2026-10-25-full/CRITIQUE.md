# Impeccable critique: Dealership, before (2026-10-25)

Run as two isolated sub-agents: Assessment A (design review of the live before shots plus source) and Assessment B (`impeccable detect` plus pattern greps). The browser overlay was skipped because the demo needs a login.

## Detector (B)
- `features/platform`: exit 0, no rule findings. The problems are structural, so no detector rule catches them.
- `features/storefront`: one `side-tab` warning, `.sf-notice` `border-left: 3px` (`showroom.css:537`).
- Pattern counts:
  - `rounded-full`: 58 lines in 33 files.
  - Mono uppercase tracked eyebrows: 60 lines in 44 files.
  - `shadow-[inset`: 6.
  - All of these are concentrated in `features/platform/components/desk.tsx`.

## Design review (A)
- **Specificity:**
  - Platform is "generic and honest": one kit applied everywhere (header, a row of zero-valued headline numbers, a pill filter row, a stacked list).
  - Storefront is a well-made dark template wearing the dealer's name.
- **Heuristics:** visibility 2, real-world match 2, consistency 3, error prevention 2, recognition 2, flexibility 1, minimal design 2, help 1.
- **Priority issues:**
  1. The kit's identity is pills: `Track`, `Pill` and `Segmented` are used about 770 times.
  2. Every page leads with counts, not the job.
  3. Lists are not tables: no headers, no status column, no sorting.
  4. Header actions sit in one pill track with no primary/utility split.
  5. Storefront credibility gaps:
     - the same photo reused across different models;
     - credit lines on every card;
     - a missing financing step (01 → 03);
     - pill buttons and filters.
- **First-10-second tasks:**
  - Overview: what needs me today.
  - Inventory: aged units and recon-stuck units.
  - Deals: the desk log by stage, with gross and age.
  - CRM: leads waiting on a response.
  - Service: today's lane and waiting ROs.
  - Finance: the F&I queue and contracts in transit.
  - Parts: low stock and POs to receive.
  - Full table: see the agent report in the session log.

## What the redesign must do
- Replace the pill kit with flat underline tabs, 4–6px controls and real tables with status columns.
- Lead each page with a work queue ("needs you"), and push summary figures into a quiet strip.
- Storefront:
  - Replace the night-lot template with a specific dealer world.
  - Show credits once per photo, not as a line on every card.
  - Fix the financing numbering and the placeholder that looks like a value.
