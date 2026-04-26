# AUTONOMOUS_CONTEXT.md

## Identity
- Project: Openfront Dealership
- Repo Path: /Users/junaid/code/openfront-dealership
- Target Competitor / Incumbent: CDK Global / Reynolds & Reynolds
- Source-of-truth Checklist: /Users/junaid/.vibeghost/ghost/memory/checklists/openfront-dealership.md
- Build Status: in_development

## Mission
Build a merchant-owned open-source dealership management system for vehicle inventory, digital retailing, leads, trade-ins, financing, deal desking, service department workflows, and open inventory discovery interoperability.

## Current Status
This repo already has a real Openfront-style structure with storefront, dashboard, and platform slices. The checklist is lighter than other verticals, so autonomous work should use both the checklist and the code.

## User Story Lens
Use user stories to decide what features need to exist, how complete they are, and how robust they need to become.

### Car shopper
- Car shopper should be able to browse vehicles, inspect listings, submit leads, request test drives, and explore trade-in or financing flows

### Sales rep
- Sales rep should be able to manage leads, follow up, and work deals through desking workflows

### F&I manager
- F&I manager should be able to work financing and deal approvals

### Service advisor
- Service advisor should be able to manage service appointments, orders, repair items, and customer communication

### Dealership owner
- Dealership owner should be able to inspect inventory, sales, service performance, and core dealership metrics

## Major Parity Features
These are the major product capabilities the repo should grow toward if it is going to become a credible open-source alternative to the incumbent:

- vehicle catalog and merchandising
- lead forms and CRM
- test-drive workflows
- trade-in workflows
- financing calculator and finance flows
- deal desking and approvals
- service department/fixed ops workflows
- reporting and analytics
- inventory discovery interoperability

## Autonomous Working Rules
- Work autonomously and keep making real product progress.
- Do not stop to ask for confirmation unless absolutely necessary.
- If you finish one obvious task, move to the next meaningful gap instead of stopping.
- If you feel lost, compacted, or unsure what to do next, reread this file first. Also reread the checklist at `/Users/junaid/.vibeghost/ghost/memory/checklists/openfront-dealership.md` if direction is unclear.
- Read the code before making assumptions.
- Verify what already exists before rebuilding it.
- Keep the product grounded, specific, and useful. Avoid generic AI-looking output.
- Do not mistake shallow scaffolding for parity.

## Important Non-Goals For Autonomous Mode
- Do not run migrations.
- Do not commit changes.
- Do not create fake completion theater or filler work.
- Do not stop after one narrow task if there are still obvious parity gaps to close.

## Owner Workflow Reminder
- Junaid will review the work.
- Junaid will run migrations manually if needed.
- Junaid will decide what to commit.

## Priority Directions
- Improve digital retailing flows such as financing calculations and customer-facing merchandising quality.
- Deepen CRM, deal desking, and service-advisor workflow quality.
- Improve fixed-ops operator tooling.
- Add stronger reporting for units, gross profit, and service metrics.

## Autonomous Product-Parity Loop
Repeat this loop continuously instead of treating the work like a one-time task list:

1. Remember which incumbent or product category this repo is trying to replace.
2. Use the user stories in this file to identify what people in this product need to be able to do.
3. Translate those user stories into concrete product capabilities and features.
4. Check the codebase and determine which of those features already exist.
5. If a required feature is missing, build it.
6. If a feature exists but is shallow, incomplete, or generic, deepen it.
7. If a feature exists but is brittle, awkward, or underpowered, make it more robust and operator-grade.
8. After improving a feature, step back and ask how much closer the product is to being a credible open-source alternative.
9. Identify the next biggest parity gap and repeat.

## What To Do When You Think The Obvious Features Are Done
If the obvious features appear to exist already:

1. Check whether those features are actually implemented end to end.
2. Check whether they feel believable for real users and operators.
3. Check whether the workflows are robust, detailed, and specific to the vertical instead of generic CRUD.
4. Improve weak implementations until they feel like real product features.
5. Then go back to the incumbent comparison and ask what still needs to exist for parity.

## If You Get Lost
1. Reread this file.
2. Reread the checklist at `/Users/junaid/.vibeghost/ghost/memory/checklists/openfront-dealership.md`.
3. Re-read the user stories and ask what each actor still needs to be able to do.
4. Inspect the repo and identify what is already built.
5. Continue with the next highest-leverage parity gap, robustness improvement, or user-workflow improvement.
6. Prefer real implementation progress over asking for permission.
