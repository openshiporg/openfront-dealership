# Dealership: full redesign of platform pages and storefront (2026-10-25)

Brief: `~/Code/Euler/state/briefs/batches-2-6-full-redesign-2026-10-25.md`.

Live: https://openfront-dealership-production.up.railway.app (dealership.openship.org once DNS is in).

This is a redesign, not a polish. The earlier "lot at night" storefront and the pill-in-track platform kit were treated as evidence, then replaced. The shared dashboard shell is byte-identical to E-commerce (parity drift 0).

## Process (impeccable)
- **`impeccable context` and init.** The owner ordered no approval stage, so the interview was skipped and `PRODUCT.md` was inferred. Every line is marked as inferred.
- **Critique.** Run as two isolated sub-agents:
  - Assessment A, design review: verdict "generic and honest". It found pills as the kit's identity, every page leading with zero-valued counts, and lists that are not tables.
  - Assessment B, `impeccable detect` plus greps: the platform passes the detector's rules; the storefront has one side-tab finding.
  - The synthesis is in `CRITIQUE.md`.
- **Direction rolls.** `concept-seed`, two rolls:
  - Platform (Operate) assigned my candidate 6 of 7, the grease-pencil windshield numbers. Seed `d40957704c0b59e9`.
  - Storefront (Persuade) assigned candidate 6 of 7, the dealership's wayfinding signage. Seed `39d3e1e83f679c2f`.
  - Each challenger was weighed, and the declined ones donated raises. They are recorded in the direction contracts at `.impeccable/surfaces/features-{platform,storefront}.md`.
- **Build.** I rebuilt the platform kit (`components/desk.tsx`) and the storefront system (`tokens.css`, `signage.css`, fonts) myself. I then fanned the screens out to 8 agents working on separate directories, all bound by the contract and `craft-floor.md`.
- **Gates.**
  - `impeccable detect` returns [] on `features/platform` and `features/storefront`.
  - Real `tsc --noEmit` exits 0 on the pushed commits.
  - Unit tests: 22/22.
  - Parity check: drift 0.
- **Finish review.**
  - A fresh `impeccable-finish-reviewer` returned `fix` with 8 items. One fix batch was deployed.
  - The verdict pass scored the batch 4 resolved and 4 partial, and found 2 small regressions.
  - A second batch addressed the remaining items. See "Open" below.
- **Documentation.** `impeccable-documenter` wrote `DESIGN.md` and `.impeccable/design.json` from the shipped code.

## Platform: "the lot's windshield numbers"
Every page now opens on a **"Needs you" queue**: what is waiting on this operator, oldest or most urgent first, built from data the page already loads. The full record follows in a real table with a status column, under underline tabs and search. Summary figures sit below the work as one borderless hairline row.

**Kit (`features/platform/components/desk.tsx`):**
- Underline tabs instead of recessed pill tracks.
- 4px buttons: one ink primary per header, utilities as ghost buttons.
- 6px panels and a dense `DeskTable` with sticky headers and priority columns that drop on phones.
- `Status` (mark plus word), so colour is never the only signal.
- `Figure`: condensed Archivo numerals for price, stock, days and gross.
- Lot yellow (`Figure attention`, `Attention`) marks only aged, overdue or waiting items. Warn states moved off yellow.

**What leads each page:**

| Page | Leads with |
|---|---|
| Overview | Needs you today: drives today, deals on the desk, uncontacted leads, ROs by stage, funding and payment exceptions, low parts, aged units. Then latest deals, the lead pipeline as a table, and the summary rows at the bottom. |
| Inventory | Aged, recon, listing and photo work as a queue with the next step on each row. Then the lot table: photo, vehicle, stock #, status, recon, listing, days, price. |
| Deals | The desk log: pencil and submitted deals, oldest first, stale ones in yellow. The deal detail has a four-square of Figures and an F&I panel. |
| CRM | Leads waiting on a first response, sorted by overdue. Then 9 status tabs and a table. |
| Tasks | Due today. |
| Test drives | Today and past due. |
| Trade-ins | Appraisals awaiting a value. |
| Customers | Search first. |
| Finance | The F&I queue: waiting approval, in F&I, contracts in transit, unfunded, exceptions. The deal panel opens only on demand. |
| Payments | Failed, unreconciled and uncaptured payments. |
| Accounting | Failed, staged and out-of-balance batches. The journal is a debit/credit table. |
| Service | Today's lane in time order, then ROs waiting on parts, approval or pickup. RO lines are a dense money table. |
| Parts | Below reorder point, then POs to receive. |
| Staff | Members with no role. |
| Organization | Invites awaiting activation and suspended rooftops. |
| Catalog | Models missing from the catalog and routing gaps. |
| Store settings | Missing required fields, then sections in the order operators fix them. |
| API keys | Expired keys not yet revoked. |
| Reports | Failed and overdue runs. |
| Analytics | Month to date as a hairline row, then what needs attention, then hairline charts. |

## Storefront: "the rooftop's signage in daylight"
- **Home.** It opens as the dealership's directory sign: an enamel panel in the logo hue with the name in Overpass heavy.
  - The **Sales row holds the live inventory search**: condition, make, model, year, max price.
  - Test drive, Trade-in, Financing and Service are door rows with arrows.
  - The lead car sits beside the sign with its painted **stall number** and price.
- **System.**
  - Cool concrete ground and white panels.
  - Overpass for display, Public Sans for body, Overpass Mono for stock numbers, VINs and miles.
  - Joined square segmented plates with the current choice inked. No pills anywhere.
- **Inventory.** Filters sit beside the results, which use stall-numbered cards. Cards show a miles/colour/status row and a "Representative photo" plate whenever the bundled photo shows a different model. The seed data reuses photos; seed files are off-limits, so this labels the photo honestly rather than replacing it.
- **Vehicle detail** leads with gallery, title, price, stall number and actions.
- **Service** is painted as the service lane: asphalt with a dashed lane-yellow line.
- **Financing.** Fixed the 01 → 03 step gap and placeholders that looked like entered values.
- Every route, state, workflow, field name and photo credit is kept.

## Skills used, per screen, and what each changed
- **impeccable:** the whole process above. `context`, inferred init, two-agent critique, `concept-seed` rolls, direction contracts, craft floor, detector, finish reviewer with a verdict pass, documenter.
  - Platform: Operate mode rules (the world lends type, palette, density and one signature move, never the layout).
  - Storefront: Persuade rules (the working search lives in the sign itself).
- **design-taste-frontend / frontend-design:** the "idea comes from the subject" inventory behind both seven-candidate lists. The generated-design defaults list removed mono uppercase eyebrows (60 lines), "01/02" numbering, middle-dot meta strings in headers, and kickers above headings.
- **minimalist-ui:** platform controls as flat 4–6px plates with no heavy shadows, and hairline borders instead of cards. I rejected its pill badges because of the owner's rule.
- **industrial-brutalist-ui (Swiss industrial print):** the condensed heavy figures (`Figure`), the `gap-px` hairline grids, and the storefront's rigid sign rows. I rejected its uppercase mono labels.
- **gpt-taste:** the meta-label ban applied to the storefront (no "SECTION 01"-style labels), and the hero headline kept to two lines.
- **high-end-visual-design / emil-design-eng:** a single ease-out curve and one authored motion (the door-row arrow slide). Reduced motion is respected. I rejected the pill CTAs and double-bezel cards.
- **hallmark / creative-director:** used as the anti-template check when choosing between the seven grounded candidates.
- **color-expert:** oklch tokens, with contrast held at 4.5:1 or better on body text (ink-3 at L 0.52 on white).
- **apple-design:** 40–44px phone targets, and controls kept standard (no invented affordances).

## Commits (master, auto-deployed)
- `15e3f47` Platform redesign: flat desk kit, work queues first, real tables.
- `f26a442` Storefront redesign: the rooftop's signage in daylight.
- `39eb5f0` Design record: product context, direction contracts, critique and before screenshots.
- `d56bb8f` Redesign finish-review fixes.
- A second fix batch (Analytics hairline row; Overview, Service and Payments strips moved below the work; platform "Similar" photo marker; warn hue; phone subtitle wrap; 13px controls; staff search placeholder) is committed locally after its typecheck. See the session report for its push status.

## Screenshots
Playwright, 1440x900 and 390x844, full page. 26 routes each, captured from the live demo.
- Before: `before/before-*.jpg`
- After: `after/after-*.jpg`

The demo has little transactional data (0 deals), so many queues show their empty state.

## Open
- **Empty states** still use three treatments: dashed box, solid box and bare text.
- **Storefront mono** still appears on some non-data text (phone numbers, day names, "Not set").
- **No URL filters:** the platform pages don't read URL filter params, so Overview queue rows open the right page unfiltered.
- **The reviewer's second verdict** was not rerun after batch 2. Two rounds is the budget for an unattended run.
