# Pantry Hold

One-day TypeScript hackathon project. The approved product contract and scope are in
`docs/tasks/winning-zerops-project/plan.md`.

## Product invariants

- The demo inventory is fictional.
- Recall evidence comes from openFDA or a clearly labelled cached official response.
- A possible hold requires exact typed identifiers such as product code, UPC, or lot.
- Product-name similarity must never create a match or hold.
- Sync and matching run through the real worker and persisted repository path.
- Never claim that Pantry Hold determines safety, issues public alerts, or certifies compliance.

## Before changing code

- Read the approved plan, `package.json`, and only the files relevant to the task.
- Inspect `git status` and preserve pre-existing or concurrent changes.
- Define the task's success checks before implementing.
- Ask only when ambiguity changes the product contract, architecture, spending,
  deployment, or another external state.
- Do not create competing planning or context files when the existing plan is sufficient.

## Scope and design

- Work on one bounded concern at a time.
- Prefer the smallest implementation that makes correct behavior obvious.
- Do not add speculative features, generic abstractions, configuration systems,
  services, dependencies, authentication, fuzzy matching, AI, or NATS.
- Reuse existing repository patterns and style.
- Do not refactor, reformat, or remove unrelated code.
- Record discarded approaches when their failure changes the plan.

## Verification

- Add focused tests for changed domain or backend behavior.
- Cover the positive path and the most important rejection or failure path.
- Use deterministic completion signals; do not use arbitrary sleeps to make tests pass.
- During iteration, run the smallest relevant test, lint, or typecheck command.
- Before handoff, run `npm run verify`.
- For user-visible changes, prove the seeded demo through the real API and worker path.
- Report every check that was skipped or failed.

## Git and external actions

- Never use destructive reset, checkout, clean, or commands that discard work.
- Review the final diff and ensure every changed line belongs to the task.
- Focused local commits are authorized; stage only intended paths and keep one concern per commit.
- Do not amend or rewrite published history.
- Do not push, open a PR, deploy, provision services, or mutate external accounts unless the
  main task has confirmed the applicable authorization and safety gate.
- At 85% Codex quota used, stop spawning new Codex-heavy work and prepare the user-approved
  `sol-orchestrator` Grok fallback. At 99% used, stop all active agents before paid credits begin.

## Handoff

Report the outcome, changed files, verification commands and results, deviations, and remaining
risks. Do not claim completion without evidence.
