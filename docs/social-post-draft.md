# Social Post Draft

I built **Pantry Hold** for the Zerops Challenge: a recall-triage demo that compares official openFDA evidence with fictional pantry inventory using exact typed identifiers.

The key negative control is deliberate: two items can share a product name, but only the one with the exact product code and lot appears as a possible match. A person records the hold or resolution action, and the audit timeline preserves it.

The Zerops deployment uses a public React/Fastify app, a private sync-and-matching worker, and private PostgreSQL. The UI shows whether evidence came from live openFDA or a labelled cached official response and links back to the source.

OpenAI Codex assisted with research, implementation, testing, hardening, browser QA, and documentation. I selected the direction, reviewed the work, and own the deployment and submission decisions.

Live app: https://app-2b48-3000.prg1.zerops.app/

Demo video: `[add after recording]`

Source: https://github.com/aryanhardahadev/pantry-hold

Built for @WeMakeDevs × @zeropsio.
