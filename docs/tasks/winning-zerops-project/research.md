# Research: Winning Zerops Hackathon Project

Status: Superseded findings preserved; 2026-08-09 decision is current
Owner: Research phase owner
Last reviewed by Aryan: Autonomous overnight research authorized

## 2026-08-09 decision update

The earlier RetryRail recommendation below is historical and no longer current. RetryRail was retired after the prior WeMakeDevs gallery showed heavy retry/self-healing overlap. Generic ColdChain Witness was then rejected because it depends on simulated hardware and overlaps mature cold-chain monitoring products.

Three independent final juries compared RecallReady, Pantry Hold, and Breakwater. The judge-fit jury selected **Pantry Hold** because it best combines three-second clarity, a concrete user, real public data, a strong action-oriented UI, meaningful app/worker/database services, and Sunday-night feasibility. The implementation jury preferred Breakwater, while the data jury preferred RecallReady; their strongest lessons were incorporated as strict deterministic matching, source preservation, and a real worker path.

Verified source path: the official openFDA food-enforcement API is reachable without credentials and exposes `recall_number`, `product_description`, `code_info`, `classification`, `status`, `distribution_pattern`, and `report_date`. A current record, `H-1180-2026`, contains product code `GJ96` and lot `25/08001`, so the MVP can demonstrate exact typed-identifier matching without fuzzy product-name inference. The API is updated weekly and warns against using its data to issue public alerts or track recall lifecycles; Pantry Hold is therefore an internal fictional-inventory triage demo that links to official records and says only “possible match.”

Primary sources: [openFDA food enforcement](https://open.fda.gov/apis/food/enforcement/), [endpoint usage](https://open.fda.gov/apis/food/enforcement/how-to-use-the-endpoint/), [searchable fields](https://open.fda.gov/apis/food/enforcement/searchable-fields/).

Selected architecture: public Node web/API service, private Node sync/matching worker, and private single-node PostgreSQL on Zerops. No NATS, ZCP, authentication, external messaging, custom domain, HA, dedicated IP, or advanced observability in the MVP.

Kill condition: if official record -> normalized identifiers -> exact inventory match -> hold action is not working through the real worker within the initial implementation spike, switch to the already-scoped Breakwater fallback rather than faking matches.

## Questions

1. What are the verified rules, deliverables, judging signals, deadline, and disqualifiers?
2. What Zerops services, deployment workflows, observability features, and resource limits fit the available plan and credits?
3. Which current problem spaces offer a useful, distinctive, solo-buildable MVP with a strong live demo?
4. Which 3–5 ideas survive comparison on originality, usefulness, technical depth, Zerops fit, demo strength, and schedule risk?
5. What is the smallest architecture and demo for the leading idea, and what evidence would invalidate the recommendation?

## Executive conclusion

The provisional recommendation is **RetryRail**: a self-hosted webhook reliability gateway and failure lab. It accepts webhook events immediately, queues delivery, records every attempt, retries with visible backoff, dead-letters persistent failures, and lets a developer replay an event after recovery. A built-in unstable receiver makes the failure → retry → recovery sequence deterministic in the live demo.

This is stronger than a generic AI agent, CRUD dashboard, or Zerops YAML generator because the product's actual mechanism maps directly onto Zerops services and private networking. The user can explain every important algorithm without depending on an opaque model or paid inference API.

The recommendation is not approved yet. It should be overturned if the user has fewer than roughly 12 focused build hours, is not comfortable with TypeScript/backend/SQL, strongly prefers a different domain, or discovers a near-identical entry already being built in the event community.

## Verified findings

### Event rules and judging signals

- **Conclusion:** Eligibility depends first on a reachable working Zerops deployment, accessible source code, and more-than-trivial architecture. The best-overall project is judged on the idea, execution, and how Zerops is used.
- **Evidence:** The official [rules](https://www.wemakedevs.org/hackathons/zerops/rules) require solo work, one project, a working and reachable Zerops deployment through judging, meaningful Zerops use, accessible source, a demo video, Zerops explanation, AI disclosure, original contribution, and technical understanding. A Hello World does not qualify; frontend + backend + database is the recommended shape. The official [overview](https://www.wemakedevs.org/hackathons/zerops) says the main track is judged on “the idea, the execution, and how Zerops is used.”
- **Confidence:** High.
- **Planning implication:** Build a narrow end-to-end product with a judge-verifiable mechanism. Do not trade core reliability or demo clarity for a long feature list.

### Submission surface conflicts with the written rules

- **Conclusion:** The currently visible submission form is less complete than the written rules, so we must follow the stricter written requirements.
- **Evidence:** On 2026-08-08, the authenticated form at `https://www.wemakedevs.org/hackathons/zerops/submit` exposed required title, description, repository, and live URL fields plus an optional-looking social-post URL. It did not expose separate demo-video, Zerops-explanation, or AI-disclosure fields. The official rules nevertheless require all three, and the overview says the public build post is mandatory and must contain the demo, live link, Zerops explanation, and tags.
- **Confidence:** High for the currently visible UI; medium for whether the form will change before cutoff.
- **Planning implication:** Put the demo-video link, Zerops architecture explanation, and AI disclosure into the project description and README even if no dedicated form field appears. Complete both the form and build post.

### Registration and current platform state

- **Conclusion:** Registration is confirmed; the Zerops project exists and contains no user application services.
- **Evidence:** Gmail contains an authenticated WeMakeDevs message dated 2026-08-08 with subject “You're registered for The Zerops Challenge.” The signed-in Zerops project page showed EU Central (prg1), “Add your first service,” zero egress, the built-in logs browser, advanced-observability entry point, and ZCP available but not enabled.
- **Confidence:** High.
- **Planning implication:** No registration work remains. All service creation and spending-affecting actions remain gated behind explicit approval.

### Exact cutoff remains unverified

- **Conclusion:** The event clearly spans August 8–9 and markets “48 hours,” but an exact clock time is not published in the visible rules, overview, registration email, or submission form.
- **Evidence:** The official pages show a live countdown and say submissions close Sunday, August 9. The confirmation email says submissions open from August 8. The kickoff livestream was scheduled for 7:00 PM IST on August 8 and had not begun when inspected at 6:21 PM IST.
- **Confidence:** High that the exact time is not visible in the inspected sources.
- **Planning implication:** Treat **August 9 evening IST as a dangerous outer bound**, not a working deadline. Target a stable deployed MVP several hours earlier and re-check announcements after the kickoff.

### Zerops resource economics require explicit caps

- **Conclusion:** Lightweight Core is free, but application services consume metered resources. The Z15 promotional credit should be ample for a small capped MVP, but this must be verified in the calculator before creating services.
- **Evidence:** Zerops [pricing](https://docs.zerops.io/company/pricing) includes 15 build hours, 5 GB backup storage, and 100 GB egress with Lightweight Core. Services are billed by the minute: shared CPU is listed at $0.60 per CPU/30 days, RAM at $0.75 per 0.25 GB/30 days, and disk at $0.05 per 0.5 GB/30 days. A daily spending limit only warns; it does not stop services. PostgreSQL supports a 0.25 GB RAM minimum and 1 GB disk minimum in [its scaling guide](https://docs.zerops.io/postgresql/how-to/scale).
- **Confidence:** High for rates and limits; medium for total cost until service resource envelopes are chosen.
- **Planning implication:** Use shared CPU, single-container PostgreSQL, one container per runtime, narrow min/max autoscaling bounds, and no dedicated IPv4 or advanced observability stack for the MVP. Calculate the maximum monthly burn before import. Do not mistake the spending-limit warning for a hard cap.

### Zerops can be central to the product rather than incidental hosting

- **Conclusion:** A multi-service asynchronous system can demonstrate Zerops private networking, managed database, declarative pipelines, readiness checks, logs, and resource controls with no extra observability stack.
- **Evidence:** Zerops documents automatic [private service networking](https://docs.zerops.io/features/access), cross-service [environment-variable isolation and references](https://docs.zerops.io/features/env-variables), configurable [build/deploy pipelines and readiness checks](https://docs.zerops.io/features/pipeline), built-in project/service [logging](https://docs.zerops.io/references/logging), and managed PostgreSQL with encrypted backups and autoscaling in the [PostgreSQL overview](https://docs.zerops.io/postgresql/overview).
- **Confidence:** High.
- **Planning implication:** The demo and README should explicitly show public ingress, private API/worker/database communication, the committed `zerops.yaml`, readiness checks, structured logs, and resource caps.

### Webhook failure is a concrete, documented problem

- **Conclusion:** Webhook delivery needs asynchronous handling, idempotency, retry/replay, ordering awareness, and operational visibility—exactly the behavior RetryRail would demonstrate.
- **Evidence:** GitHub's [webhook best practices](https://docs.github.com/en/webhooks/using-webhooks/best-practices-for-using-webhooks) require a 2xx response within 10 seconds and recommend queued asynchronous processing. GitHub [does not automatically redeliver failed deliveries](https://docs.github.com/en/webhooks/using-webhooks/handling-failed-webhook-deliveries), and manual redelivery is limited to recent deliveries. GitHub also documents out-of-order delivery and replay protection. Stripe's [webhook guide](https://docs.stripe.com/webhooks) warns that events can arrive out of order and that manual resend does not cancel automatic retries. CloudEvents exists because publishers use inconsistent event formats, according to the [CNCF CloudEvents project](https://cloudevents.io/).
- **Confidence:** High.
- **Planning implication:** The MVP is solving a real failure mode, not inventing a hackathon-only problem. Its core should be deterministic mechanics, with CloudEvents normalization or provider adapters only as stretch work.

### Prior WeMakeDevs winners favor complete, visual, sponsor-native systems

- **Conclusion:** Strong past entries tend to expose an understandable end-to-end mechanism through a visual interface, and use the sponsor technology as a product primitive rather than a logo in the architecture slide.
- **Evidence:** Official winner galleries include an adaptive contract workspace and visual workflow generator in the [Tambo hackathon](https://www.wemakedevs.org/hackathons/tambo/projects), a visual backend builder in the [Motia hackathon](https://www.wemakedevs.org/hackathons/motiahack25/projects), and a distributed real-time safety system in the [Vision Agents hackathon](https://www.wemakedevs.org/hackathons/vision/projects). This is an inference from the published winners, not a disclosed rubric for the Zerops Challenge.
- **Confidence:** Medium.
- **Planning implication:** Prioritize a visually legible event timeline and a deterministic failure-recovery demo. Avoid another generic chat surface or broad “AI operating system.”

## Candidate comparison

Scores are 1–5. Weighted total is out of 100: originality 20%, usefulness 20%, technical depth 15%, Zerops fit 20%, demo strength 15%, time feasibility 10%.

| Candidate | Original | Useful | Depth | Zerops fit | Demo | Feasible | Weighted |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| **RetryRail — webhook reliability gateway + failure lab** | 4 | 5 | 5 | 5 | 5 | 4 | **94** |
| **ShipProof — deployment evidence passport and release gate** | 4 | 4 | 4 | 5 | 4 | 4 | **84** |
| **Incident Atlas — live incident room, timeline, and public status engine** | 3 | 4 | 5 | 5 | 5 | 2 | **82** |
| **Lineage Lab — replayable data-transformation pipeline with provenance graph** | 4 | 4 | 5 | 5 | 3 | 3 | **82** |
| **Blueprint Doctor — Zerops config analyser, cost guard, and architecture visualiser** | 2 | 4 | 4 | 5 | 4 | 4 | **76** |

## Adversarial review: why each idea could lose

### RetryRail

- **The roast:** “Webhook inspector with a retry button” is a known category, not innovation. If the product is just RequestBin wearing a green Zerops badge, judges should reject the hype.
- **What saves it:** Make the live causal chain the product: instant accept, durable queue, failed attempts, visible exponential backoff, dead-letter state, deterministic receiver recovery, and replay/idempotency. The built-in chaos receiver and event timeline are the differentiators, not a payload viewer.
- **Kill condition:** No working automatic retry/recovery loop by the MVP checkpoint.

### ShipProof

- **The roast:** A scanner that emits a score is often a fancy checklist pretending to be infrastructure. Static recommendations without real probes are cheap to generate and easy for judges to distrust.
- **What saves it:** Run actual synthetic checks and store signed evidence before/after a release.
- **Kill condition:** If it cannot compare real deployment behavior, it becomes a shallow dashboard.

### Incident Atlas

- **The roast:** Auth, collaboration, realtime presence, alert ingestion, and status-page UX are four projects hiding in a trench coat. A simulated incident can also look fake.
- **What saves it:** A beautiful live timeline and real service signals.
- **Kill condition:** Fewer than roughly 24 focused build hours.

### Lineage Lab

- **The roast:** Data lineage is useful but visually dry. Connector and parser work will eat the weekend, leaving a DAG screenshot nobody remembers.
- **What saves it:** A dramatic replay that proves exactly which transformation corrupted a result.
- **Kill condition:** More than one input format or one transformation runtime in the MVP.

### Blueprint Doctor

- **The roast:** The official event page itself suggests a `zerops.yaml` generator, deployment analyser, migration assistant, and architecture visualiser. That is practically an engraved invitation to a crowded category. Hosting such a tool on Zerops does not prove meaningful platform use.
- **What saves it:** Real repository analysis plus a validated import/deploy dry run and hard resource-cost guardrails.
- **Kill condition:** If the main output is generated YAML or an LLM explanation.

## Recommended MVP: RetryRail

### One-sentence pitch

**RetryRail makes unreliable webhooks observable and recoverable: accept immediately, deliver asynchronously, watch every retry, then replay safely when the receiver comes back.**

### Judge-visible “magic moment”

1. In the dashboard, configure the demo receiver to fail its next two deliveries.
2. Send an event to the public RetryRail ingest URL.
3. The sender gets an immediate `202`; the event appears live as queued.
4. The worker attempts delivery, receives `500`, and the timeline shows response code, latency, and next retry countdown.
5. A second attempt fails; the receiver is switched healthy.
6. The next scheduled attempt succeeds without resending the original event.
7. Replay the event and show the idempotency/replay decision rather than silently duplicating work.

This is a much better demo than narrating architecture slides because the judge sees distributed-system behavior unfold.

### Proposed Zerops architecture

```text
Public traffic
    |
    v
web (static React/Vite) ---> api (Node/TypeScript, public ingest + SSE)
                                  |
                    private network + generated env references
                                  |
                   +--------------+--------------+
                   v                             v
           db (PostgreSQL single)       worker (Node/TypeScript)
                                                  |
                                                  v
                                   demo receiver / user target
```

- `web`: static dashboard and event timeline.
- `api`: endpoint/channel management, public webhook ingestion, immediate `202`, read APIs, and optional Server-Sent Events.
- `worker`: claims due deliveries from PostgreSQL, forwards payloads, writes attempts, applies retry/backoff, and dead-letters exhausted events. It has no public route.
- `db`: PostgreSQL single-container service for endpoints, events, deliveries, attempts, and audit history.
- Demo receiver: start inside `api` for the MVP; split into a fifth tiny service only if the four-service deployment is stable early.

### Minimal data model

| Table | Essential fields | Purpose |
| --- | --- | --- |
| `endpoints` | `id`, `name`, `ingest_token_hash`, `target_url`, `secret`, `max_attempts` | Routing and delivery policy |
| `events` | `id`, `endpoint_id`, `event_key`, `headers_json`, `payload_json`, `received_at` | Durable received event |
| `deliveries` | `id`, `event_id`, `status`, `attempt_count`, `next_attempt_at`, `locked_at` | Queue and lifecycle state |
| `delivery_attempts` | `id`, `delivery_id`, `attempt_no`, `status_code`, `latency_ms`, `error`, `created_at` | Explainable evidence trail |

Use a database transaction and row locking (`FOR UPDATE SKIP LOCKED`) for a simple durable worker queue. Do not add NATS/Valkey until a real need appears; service-count theatre is not architecture.

### MVP scope

- Create one endpoint/channel without user accounts.
- Public tokenized ingest URL accepting JSON.
- Immediate durable acceptance and `202` response.
- Background delivery worker with exponential backoff and maximum-attempt dead letter.
- Delivery list and attempt timeline with payload/headers and status.
- Manual replay.
- Deterministic demo receiver with fail-next-N and delay controls.
- Committed `zerops.yaml`, readiness checks, structured logging, and a four-service Zerops deployment.
- Seed/demo script that resets the system to a known state before recording.

### Explicit non-goals

- Authentication, teams, billing, multi-tenancy, OAuth, provider-specific integrations, arbitrary workflow building, LLM features, advanced RBAC, NATS/Kafka, Grafana/ELK, custom domains, dedicated IPv4, or HA database mode.
- Perfect exactly-once delivery. The honest contract is at-least-once delivery plus idempotency evidence.

### Technical risks and mitigations

| Risk | Mitigation | Stop condition |
| --- | --- | --- |
| Retry scheduler races or double claims | PostgreSQL transaction + `SKIP LOCKED`; one worker container for MVP | Fall back to a single polling worker with locked rows |
| SSRF through arbitrary target URLs | MVP allowlist/demo mode; block loopback/link-local/metadata ranges; document limitation | Do not expose unrestricted target creation publicly |
| Secrets/personal data in stored payloads | Payload size cap, header allowlist/redaction, short retention | Disable raw payload display if safe handling is incomplete |
| Live UI consumes too much time | Poll every 2 seconds first; add SSE only after the loop works | No SSE until deployed core is stable |
| Resource credit burn | Shared CPU, narrow max RAM/disk, one container, no HA/observability add-ons | Do not import until maximum cost is reviewed and approved |
| Flaky demo target | Built-in deterministic receiver and seed/reset command | Never depend on an external SaaS for the recorded demo |

## Recommendation for planning

Approve RetryRail only after the user answers two scope-changing questions:

1. How many focused build hours are realistically available before August 9 evening?
2. Is TypeScript/Node + React + PostgreSQL a comfortable stack, or is another stack materially faster for the user?

If the answer is at least ~16 hours and the stack is comfortable, proceed to a ruthless four-checkpoint plan: local vertical slice, automatic retry loop, Zerops deploy, demo/submission package. If fewer than ~12 hours remain, switch to ShipProof or a reduced RetryRail with polling UI and no SSE/redaction/provider adapters.
