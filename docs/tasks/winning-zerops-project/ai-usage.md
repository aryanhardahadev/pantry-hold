# AI Usage Disclosure Log

This log records AI assistance for later disclosure. It should be updated as work occurs, not reconstructed at submission time.

## 2026-08-08 — Research and project strategy

- **Tool:** OpenAI Codex.
- **Used for:** Reading the user-provided context; inspecting official WeMakeDevs rules/resources/submission pages and Zerops documentation; checking the registration email; comparing project directions; stress-testing scope and risks; drafting the durable brief and research artifacts.
- **Human contribution/decision:** The user supplied the event/account constraints and requested adversarial research. No project idea or implementation has yet been approved by the user.
- **Code generated:** None.
- **Infrastructure changed:** None.
- **Important boundary:** Codex did not purchase a plan, enable ZCP, create Zerops services, connect a repository, submit a form, send email, or deploy an application.

## Implementation entries

### 2026-08-09 — Overnight selection and orchestration

- **Tool:** OpenAI Codex main task plus isolated Codex research tasks, primarily GPT-5.6 Sol at high effort with task-appropriate supporting runs.
- **Used for:** Full candidate re-audit; competitor and prior-winner scan; cold-chain domain validation; official-data/API feasibility; Zerops architecture and cost audit; final jury across RecallReady, Pantry Hold, and Breakwater; Git and quota-guard setup.
- **Human contribution/decision:** The user authorized autonomous overnight research and implementation, local Git with incremental commits, GitHub Actions, promo-balance deployment after a forecast, and a hard stop at 99% Codex quota usage.
- **Decision:** Pantry Hold selected. ColdChain, RetryRail, and generic Breakwater rejected as the primary product.
- **Infrastructure changed at this stage:** Local Git repository initialized only. No Zerops service, purchase, GitHub repository, or deployment was created during selection.

### 2026-08-09 — Sol-high implementation and hardening

- **Tool:** OpenAI Codex using GPT-5.6 Sol at high effort, with isolated implementation and review tasks.
- **Used for:** Implementing the shared domain contract, exact typed-identifier matching, openFDA normalization and cached-official fallback, PostgreSQL/PGlite persistence, API, private worker, React dashboard, hold/resolution audit trail, deterministic tests, GitHub Actions, Zerops configuration, health checks, resource forecast, and documentation.
- **Hardening:** Codex reviewed integration boundaries, upgraded vulnerable or stale runtime dependencies, stabilized the persistent local dev path, tightened delivery-config validation, improved error states and accessibility, and completed final demo preflight fixes.
- **Human contribution/decision:** The user set the product invariants, approved Pantry Hold and the bounded architecture, required deterministic evidence and a real worker path, reviewed the cost boundary, and retained control of deployment and submission decisions.
- **Code review path:** The work was reviewed and merged through PR #1 (integration hardening), PR #2 (development stability), PR #3 (demo preflight and UI polish), and PR #4 (Zerops health-check duration compatibility).

### 2026-08-09 — Independent audits and browser QA

- **Tool:** OpenAI Codex subagents plus browser automation under the main task's review.
- **Used for:** Independent competitor and Zerops audits; adversarial product review; checking that product names never create matches; exercising reset, sync, exact-match evidence, the same-name negative control, hold, resolution, source links, responsive layout, and user-facing provenance through the running application.
- **Outcome:** Browser QA and automated tests confirmed that the UI uses the real API, worker, and persisted repository path. Issues found during review were fixed in PRs #1–#3 rather than documented as exceptions.
- **Media:** Codex assisted in selecting the checked dashboard screenshot and drafting the demo/submission copy. No generated product imagery was used.

### 2026-08-09 — Current external-state boundary

- **GitHub:** Codex assisted with local commits, branch/PR preparation, and verification of the public `aryanhardahadev/pantry-hold` repository. GitHub CLI is authenticated as `aryanhardahadev`; PRs #1–#4 are merged.
- **Zerops:** Codex researched and prepared `zerops.yaml`, `zerops-import.yaml`, validation, and the initial `$4.35 / 30 days` forecast. After authorization, exactly `app`, `worker`, and PostgreSQL 18 `db` were provisioned in the existing Lightweight project. Codex diagnosed the first app/worker pipeline failure as numeric health-check durations being invalid Go `time.Duration` values and assisted with the PR #4 fix. All three services are active; ZCP, public IPv4, HA, and add-ons remain disabled.
- **Deployment QA:** Codex assisted in verifying the no-login live app, API health/readiness, live official openFDA match, same-name negative control, hold-to-resolve three-event persistence, clean console, reset baseline, private worker readiness, and live sync logs. The observed allocation is app `1 CPU / 0.25 GB / 1 GB`, worker `1 / 0.25 / 1`, and db `1 / 0.5 / 1`, totaling `$5.10 / 30 days` in Zerops.
- **Publication:** A public source repository and live Zerops URL now exist. Codex has not submitted the hackathon form, published a build post, uploaded a demo video, sent email, or selected a legal license.
- **Exact boundary:** Deployment and live verification are complete. Demo-video publication, the public social post, and the hackathon submission remain pending human-controlled external steps.

Add an entry for every material AI-assisted design, code, test, debugging, deployment, documentation, and media task.
