# Pantry Hold Demo Script

Target: 80–88 seconds. Reset the seeded demo before recording.

## 0–10 seconds — Problem and boundary

“Pantry Hold helps a person compare official recall evidence with fictional pantry inventory. It reports only possible identifier matches for review.”

Show the persistent **fictional inventory** label and the hero result.

## 10–25 seconds — Real source provenance

Click **Sync source**.

“The worker requests official openFDA record `H-1180-2026`. The status tells us whether this run used the live response or the clearly labelled cached copy of that official response, and the record preserves its source link, fetch time, and raw hash.”

## 25–48 seconds — Exact match and negative control

Point to `product_code:GJ96` and `lot:25/08001` on both sides.

“This item appears because both typed identifiers are exact. The second inventory item has the same product name but different identifiers, so it is not matched. Names alone never create a result.”

## 48–63 seconds — Human action and audit

Enter a short note and click **Hold for staff review**, then show the audit timeline.

“A person decides the workflow action. Pantry Hold persists the note and timeline; it does not make the decision or issue a public alert.”

## 63–80 seconds — Zerops causal path

Show the architecture or deployed service view.

“On Zerops, the public app only reads persisted state and records actions. The private worker performs source sync and exact matching, while private PostgreSQL connects both paths. That separation is the product’s causal chain, not a browser-side simulation.”

## 80–88 seconds — Close

Open the official source link.

“Every result stays tied to official evidence and leaves the final review with a person.”
