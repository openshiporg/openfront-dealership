---
version: 1
slug: "features-platform"
primary_target: "features/platform"
related_targets: []
---

# Surface: dealership platform pages (`features/platform/**`)

Mode: Operate. Users: sales managers, salespeople, F&I, delivery, service advisors, parts, office. Job: see what needs them today and act on it in one or two clicks. Constraints: the shared dashboard shell (sidebar, breadcrumbs, PageContainer) is fixed and byte-identical to E-commerce; owner bans pill or heavily rounded tabs, chips and cards (radii ≤6px, flat or underline tabs, dense tables, real status columns). Inferred without interview (owner ordered no approval stage).

## Direction contract
THESIS: The lot's windshield numbers. A dealership marks every car on the glass in grease-pencil figures (price, stock, days) and circles the ones that need attention; each page leads with the queue of units/people that need the operator now, figures set big and condensed like windshield numbers, instead of the category default of a row of zero-valued KPI cards over a pill filter.
OWN-WORLD: Shell neutrals (white ground, zinc hairlines), carbon ink, one "lot yellow" grease-pencil marker reserved for attention (aged, overdue, waiting); state colours only with a word. Archivo condensed 700 for figures; Geist for everything else at 12/13/14/20/24px. Square 4px controls, 6px panels, underline tabs, hairline tables with sticky headers.
STORY: The operator opens a page, sees "Needs you" first (what is waiting, oldest first, with a yellow mark on what has gone stale), works it from the row, and drops to the full table below when they need everything.
FIRST VIEWPORT: Title left with one primary action right (utilities as quiet ghost buttons); directly under it the attention queue as a dense table or list with the windshield figure on each row; underline status tabs and search above the full table; summary figures demoted to one quiet hairline strip.
FORM: candidate 6 of 7 (grease-pencil windshield numbers), seed:d40957704c0b59e9. Raises: from operate-c-emission-line-rail, state never by hue alone (every status pairs a mark with its word); from vernacular-ephemera-boarding-pass-and-gate-board, queues ordered by urgency and columns drop by priority at narrow widths; from rw-timetable-slide-rack, a held type scale (five sizes, no ad-hoc tracking or mono eyebrows).
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
