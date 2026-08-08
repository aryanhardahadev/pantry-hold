# Brief: Winning Zerops Hackathon Project

Status: Approved for autonomous implementation
Owner: Orchestrator
Last updated: 2026-08-09

## Selected product

**Pantry Hold** is an internal recall-triage board for a small food pantry. A private worker reads official openFDA food-enforcement records, extracts explicitly labelled product identifiers, and compares them with a clearly fictional demo inventory. The public app presents only deterministic possible matches, the evidence for each match, and a human hold/review workflow.

Core promise: **An official recall may match items in this pantry; show exactly why, place them on hold, and open the source record.**

Pantry Hold must never claim that a product is unsafe, issue a public alert, infer a match from fuzzy product names, or represent the demo inventory as real.

## Problem and value

We need to identify and shape one original, useful project that a solo builder can implement, deploy, explain, and demonstrate during the remaining Zerops Challenge window. The project must be technically credible, visibly benefit from Zerops, and avoid a shallow “API wrapper” impression.

## Desired outcome

A research-backed project decision with a tightly scoped MVP, clear judge-facing story, Zerops-native architecture, feasible deployment plan, memorable demo flow, and an explicit record of AI assistance suitable for the final submission.

## Acceptance criteria

- [ ] Verify current hackathon requirements and relevant Zerops platform constraints using primary sources where possible.
- [ ] Compare 3–5 feasible ideas on originality, usefulness, technical depth, Zerops fit, demo strength, time risk, and judging potential.
- [ ] Stress-test every candidate with concrete failure modes and reasons a judge might dismiss it.
- [x] Recommend one idea and explain what evidence or user decision could overturn that recommendation.
- [ ] Define the selected MVP, non-goals, architecture, services, data model, deployment approach, verification, and demo flow.
- [ ] Keep all paid purchases and paid-service enablement behind explicit user approval.
- [x] Maintain an AI-usage disclosure log from the beginning of implementation.

## Constraints

- Hackathon is online, solo-only, and runs August 8–9, 2026.
- Only one project may be submitted.
- A meaningful working project must be deployed on Zerops and remain accessible through judging.
- Submission must include an accessible source repository, live URL, demo video, Zerops explanation, and public build post tagging @WeMakeDevs and @zeropsio.
- AI tools are allowed but must be disclosed; original work and technical understanding must be evident.
- Current Zerops project is in EU Central (prg1), uses a Lightweight 30-day plan, has Z15.00 promotional credit, and has ZCP disabled.
- Zerops deployment is authorized against the existing Z15 promo balance after a cost forecast. Do not purchase a plan or enable ZCP, HA, dedicated IP, or add-ons.
- Stop all agents when an official Codex quota bucket reaches 99% used.
- Time remaining is the dominant project-management constraint; the MVP must be demoable before optional polish.

## Non-goals

- Fuzzy recall-to-inventory matching or claims derived from product-name similarity.
- Public safety alerts, food-safety determinations, compliance certification, or advice to consumers.
- Building a generic CRUD dashboard, generic chatbot, or thin third-party API wrapper without a distinctive technical mechanism.
- Depending on hardware, proprietary datasets, manual moderation, or external approvals that cannot be guaranteed during the event.
- Designing an MVP whose core demo requires paid infrastructure.

## Assumptions and open questions

- Assumption: The user can create a public or judge-accessible Git repository and publish the required build post and demo video.
- Assumption: The Lightweight plan and promotional credit can support a small frontend, backend, and database through judging; exact consumption needs verification.
- Question: What judging criteria or sponsor prizes are explicitly published?
- Question: Which Zerops capabilities can be made visible in a short demo rather than merely mentioned in architecture notes?
- Question: Which project domain best matches the user’s strongest implementation skills and authentic interests?
- Question: How many focused build hours remain before the submission cutoff?
