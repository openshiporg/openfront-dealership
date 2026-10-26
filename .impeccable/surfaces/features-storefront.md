---
version: 1
slug: "features-storefront"
primary_target: "features/storefront"
related_targets: []
---

# Surface: dealership storefront (`features/storefront/**`, `app/(storefront)/**`)

Mode: Persuade on home; Operate on inventory, vehicle detail, compare, request forms and account. Shopper choosing a car from this rooftop's lot, mostly on a phone; the action they came for is finding a car and booking a visit (test drive, trade-in value, payment estimate, service). Inferred without interview (owner ordered no approval stage). Replaces the 2026-10-25 "lot at night" world, which the owner rejected.

## Direction contract
THESIS: The dealership's own wayfinding signage in daylight. Every rooftop greets you with an enamel pylon and directional signs (Sales, Service, Parts) and paints a stall number on every space; the home page opens as that directory sign, each row a working door (the Sales row is the live inventory search), instead of the category default of a dark luxury hero photo over a floating search card.
OWN-WORLD: Cool concrete ground, white panels, the merchant's logo hue as deep enamel sign face carrying white Overpass at heavy weight; ink black; lane yellow only on stall numbers and the service lane. Overpass (Highway Gothic lineage) for display and headings, Public Sans body, Overpass Mono for stock, VIN, mileage. 3px controls, 4px photos and panels; joined square segmented controls with an ink-filled current choice; no pills anywhere.
STORY: The shopper sees which dealership and how to reach it, searches the lot from the sign itself, scans cars by stall number, price and miles, and books a test drive or service in one more step.
FIRST VIEWPORT: Desktop: enamel directory sign on the left (name, then Sales row with make/model/year/price and Search, then Service, Trade-in, Financing rows with arrows), the lead car photo on the right with its stall number and price; phone: the sign first with the search, the lead car below. Header is a white strip with address, hours and phone, nav underlined in the sign colour.
FORM: candidate 6 of 7 (dealer wayfinding signage), seed:39d3e1e83f679c2f. Raises: from vernacular-ephemera-loteria-tabla-night, every vehicle named and numbered in one breath (title with stall number) and photos never cropped awkwardly; from posters-covers-sleeves-torn-flyer-photocopy-wall, only the newest layer fully loud (one lead car, the rest quiet); from signals-instruments-nixie-laboratory-counter, quantities are the interface (price, miles, monthly estimate set as figures, not prose). Declined: hand-drawn-zine-explainer, dream-surreal-impossible-worlds-alphabet-storm, rivers-tides-ocean-depths-mesophotic-deep-dive.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
