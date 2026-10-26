# Product

<!-- impeccable:product-schema 1 -->

Inferred from the repository and the owner's redesign brief (`~/Code/Euler/state/briefs/batches-2-6-full-redesign-2026-10-25.md`) on 2026-10-25. The owner ordered the work without an approval stage, so no interview took place. Every line below is inferred, not confirmed.

## Platform

web

## Users
- **Shopper (storefront):** someone choosing a car from this rooftop's lot, usually comparing a few vehicles on a phone, then asking for a test drive, a trade-in value, a payment estimate or a service appointment.
- **Dealership staff (platform):** sales managers and salespeople working leads, test drives and deals; F&I managers on finance applications and products; delivery coordinators; service advisors and technicians on appointments and repair orders; parts counter; office/accounting on payments and journal batches; the owner reading the overview.

## Product Purpose
Openfront Dealership is a self-hostable showroom plus dealer management system for one dealer group's rooftops: inventory, CRM, test drives, trade-ins, the deal desk, finance, delivery, service, parts, payments and accounting. Success is a staff member seeing what needs them today and acting on it in one or two clicks, and a shopper getting from "which car" to a booked visit.

## Positioning
The storefront is a live projection of the same inventory, pricing, hours and service menu the staff work in, so every price, stock number and slot shown is the one on the desk.

## Operating Context
- Sales floor: leads arrive from the storefront (sales, test drive, trade-in, finance requests), get assigned, worked, and turned into deals that move pencil → submitted → approved → financed → delivered.
- Service lane: appointments become repair orders; parts are reserved, received and invoiced; payments and accounting close the loop.
- Staff use the dashboard on desktop at the desk and on phones on the lot.

## Capabilities and Constraints
- Platform routes live under `/dashboard/platform/*` inside the shared Openfront dashboard shell, which must stay byte-identical to Openfront E-commerce.
- Storefront routes: `/`, `/inventory`, vehicle detail via `[...slug]`, `/compare`, `/financing`, `/trade-in`, `/test-drive`, `/service`, `/contact`, `/photo-credits`, `/account/**`.
- No online vehicle checkout; requests are leads. Payment estimates are estimates.
- Vehicle photos are licensed third-party photos with visible credits; credits must stay.

## Brand Commitments
- The rooftop's own name, logo and logo hue come from store settings.
- Owner direction (2026-10-25): no pill-shaped or heavily rounded tabs, chips or cards on platform pages (radii ≤6px, flat or underline tabs, dense tables, real status columns). UI copy is labels, states and errors only.

## Evidence on Hand
Seeded demo inventory with licensed photos, hours, address and service menu come from the live data. No reviews, testimonials, awards or sales figures exist, and none may be invented.

## Product Principles
1. Lead with what needs the operator now, not with the data model.
2. Show only what the data proves; never imply online purchase.
3. Every route, state and workflow stays. Presentation changes; behaviour doesn't.
