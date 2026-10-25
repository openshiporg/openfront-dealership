# Dealership (Sam's Motors): storefront redesign (2026-10-25)

Brief: `Euler/state/briefs/design-skills-redesign-2026-10-25.md` (Openfront Batch 2, storefront only).

**Live:** https://openfront-dealership-production.up.railway.app (dealership.openship.org once DNS is added)

## The world
**The lot at night.**
- **Ground:** asphalt, with deeper tarmac bands.
- **Ink:** bone.
- **Accent:** the brand colour, lifted to a signal tone.
- **Type:** Archivo pushed to its widest (wdth 125) for the display.
- **Signature:** the window sticker stays a paper label, the one light object on the dark lot. `.sf-sticker` re-scopes the tokens, so everything inside it reads dark on paper.

## What changed
- `styles/tokens.css`: night-lot tokens, dark shadows, smaller radii, and the paper-sticker scope.
- `styles/showroom.css`: wider and heavier display; secondary buttons, notices, skeletons and input hover re-tuned for dark; the primary pill keeps dark text inside bands; lead-car frame and on-glass sticker styles.
- `screens/HomePage.tsx`: the lead car framed wide (now on phones too, not desktop only) with its window sticker over the photo; the actions moved beside the headline.
- `components/Header.tsx`: the masthead fill was a hardcoded light colour; it now uses the paper token.

Every route, state and workflow is unchanged: no route, data loader, server action, form field or test was removed or renamed. The shared dashboard shell and platform pages were not touched.

## Skills used, and how
- **impeccable**: read SKILL.md and set the surface modes: Persuade for the home page, Operate for booking, cart, checkout and account. Its "redesign replaces, it doesn't polish the old look" rule set the scope: a new world (ground, type, shape, signature motif), with every route, state and workflow kept. Its design hook scanned each stylesheet as it was written and reported no deterministic issues. I did **not** run `/impeccable init`, `critique` or `polish` as separate commands.
- **frontend-design**: the two-pass plan (palette of named tokens, type roles, layout sketch, principles), then a review of that plan against its list of generated-design defaults. That review removed the single italic accent word in headlines (salon), dropped 01/02 numbering on a list that isn't a sequence (vape) and kept the "near-black plus one acid accent" look out of every palette: accents are the merchant's own hue, lifted for dark and softened.
- **design-taste-frontend (tasteskill v2)**: the "idea comes from the subject" inventory. Each world comes from a physical object in the business. I didn't run its `draw.mjs` or `inspect.mjs` scripts; the live Playwright check below did that job.
- **high-end-visual-design / emil-design-eng**: custom ease-out curves only; transform and opacity motion; grain and blur kept to fixed layers; reduced motion respected (the existing guards were kept).
- **mobile-native**: 44px+ targets, `100svh`/`dvh` instead of `100vh` for heroes, no horizontal scroll at 390px (measured: overflowX=0 on every captured page).
- **Tessier as the bar**: near-black but never flat grey, off-white ink, one restrained accent, few radii, product and photography carrying the colour.

## Checks
- `tsc --noEmit`: exit 0, 0 errors.
- `parity-check.py`: drift 0.
- The repo has no storefront unit tests (only the shared dashboard and family-security suites, which these changes don't touch).

## Commits (pushed to `master`, auto-deployed)
- `c408c96` Storefront redesign: the lot at night
- `722483c` Dark masthead fill; keep dark text on the primary pill inside bands

## Screenshots (Playwright 1.62, 1440x900 desktop and 390x844 phone, full page)
Before, in `design/before-20261025/`:
- `before-home-desktop.jpg`
- `before-home-phone.jpg`
- `before-inventory-desktop.jpg`
- `before-inventory-phone.jpg`

After (live), in `design/after-20261025/`:
- `after-financing-desktop.jpg`
- `after-financing-phone.jpg`
- `after-home-desktop.jpg`
- `after-home-phone.jpg`
- `after-inventory-desktop.jpg`
- `after-inventory-phone.jpg`

## Notes
A parallel session (`demo-data-reset-2026-10-25.md`) reset this demo's database and is re-onboarding it with the full seed while this redesign shipped. The before shots were taken during or after that reset, so they may show an empty or not-configured store rather than the old design with data. The old design is in git (the parent of the first commit below). **At capture time (21:2x UTC) this store had not been re-seeded yet**, so the after shots show the redesigned shell, hero and empty states rather than the demo catalogue. Re-capture once onboarding finishes: `node shot.cjs <url> design/after-20261025 after <paths> --full`.
