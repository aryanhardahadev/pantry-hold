# Plan: Pantry Hold

Status: Approved for autonomous implementation
Owner: Main task coordinates isolated implementation tasks
Approved by Aryan: 2026-08-09

## Product contract

The demo pantry is fictional. The recall source is official openFDA data or a clearly labelled cached copy of an official response. Matches require exact typed identifiers such as product code, UPC, or lot; product-name similarity never creates a hold.

## Work graph

1. Foundation: TypeScript workspace, shared domain contract, checked official fixture, package lock.
2. In parallel after foundation:
   - Backend: API, worker, PostgreSQL/PGlite repository, exact matcher.
   - Frontend: judge-facing dashboard and hold workflow against the shared API contract.
   - Delivery: tests, GitHub Actions, Zerops config, resource forecast, documentation skeleton.
3. Main task integrates each branch, runs all checks, and proves the deterministic demo twice.
4. Provision the minimum Zerops services only after the forecast is reviewed against the promo balance.
5. Deploy, verify public/private boundaries and logs, then freeze features for submission assets.

## Acceptance evidence

- Official/cached recall record is normalized with source URL, fetch time, and raw hash.
- Inventory identifier `product_code:GJ96` and `lot:25/08001` produces one evidence-backed possible match.
- A similar product name without the exact identifiers does not match.
- A private worker performs sync and matching; the UI does not synthesize results.
- A judge can run the seeded demo without credentials.
- Hold and resolution actions are persisted with an audit timeline.
- Typecheck, unit tests, integration tests, build, YAML validation, and GitHub Actions pass.
- Zerops has one public web/API service, one private worker, and one private PostgreSQL service.

## Stop and pivot conditions

- Stop all agents at any official Codex bucket >=99% used.
- Do not use prepaid credits after the included quota is exhausted.
- Do not purchase or enable non-approved Zerops features.
- Pivot to Breakwater if the real worker/matcher path misses the first spike gate; never add fuzzy matching.
- Cut animations, extra inventory editing, source-version history, and advanced filters before cutting the causal demo.
