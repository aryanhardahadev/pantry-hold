# Pantry Hold Submission Draft

## Title

Pantry Hold

## Description

Pantry Hold is a recall-triage board for a fictional community-meal pantry. A private worker reads an official openFDA food-enforcement record, extracts explicitly labelled product codes, UPCs, and lots, and compares them with typed identifiers in fictional inventory. One seeded item shares the exact product code and lot; a same-name item with different identifiers is deliberately rejected.

The dashboard shows why a possible match appeared, whether the run used live openFDA or a labelled cached official response, and the original source link. A person can record a hold or resolution note, with each action persisted in an audit timeline. Pantry Hold does not determine recall status or issue public alerts.

## How Zerops is used

The live deployment has one public Node.js app serving React and Fastify, one private Node.js worker for source sync and matching, and one private PostgreSQL 18 service for inventory, normalized source evidence, matches, and audit actions. Zerops-generated environment references connect the services without committed credentials. Readiness and health checks, single-container allocations, and the build/deploy pipelines are declared in the repository. The active services total `$5.10 / 30 days` on the Zerops dashboard.

## AI disclosure

OpenAI Codex assisted with research, product comparison, implementation, tests, hardening, browser QA, delivery configuration, and documentation. The human author selected the product and architecture, reviewed the work, owns deployment and submission decisions, and can explain the deterministic matching path. The detailed log is in [`docs/tasks/winning-zerops-project/ai-usage.md`](./tasks/winning-zerops-project/ai-usage.md).

## Submission links

- Source: [github.com/aryanhardahadev/pantry-hold](https://github.com/aryanhardahadev/pantry-hold)
- Live app: [app-2b48-3000.prg1.zerops.app](https://app-2b48-3000.prg1.zerops.app/)
- Demo video: `[add after recording]`
- Public build post: `[add after publishing]`
- Hackathon submission: `[complete after video and public build post]`
