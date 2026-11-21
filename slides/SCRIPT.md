# Glassbox: 3-minute pitch storyboard

**Setup:** open `slides/index.html` (or https://vnmoorthy.github.io/glassbox/slides/), press **F** for fullscreen, and use **→ / space** to advance. Keep the app open in a second tab at http://localhost:8787. Total: **3:00**.

| # | Time | Slide | On screen (motion) | What you say |
|---|---|---|---|---|
| 1 | 0:00–0:15 | **Title: Glassbox** | Title and tagline rise in | "Hi, we're Glassbox: the personal shopping agent **with receipts**. It only spends your money with evidence, your rules, your signature, and a ledger nobody can rewrite." |
| 2 | 0:15–0:35 | **The problem** | Three question cards stagger in | "Agents can already click *Buy*, but nobody lets them. When an agent spends your money you can't answer three questions: *why did it pick that*, *did it follow my rules*, and *can I prove what happened?* Today you get a chat bubble that says 'Done ✅'. That's not good enough for money." |
| 3 | 0:35–0:50 | **The insight** | Mission types itself; 25 / 100 / 1 counters | "Our insight: trust equals evidence plus rules plus proof. So we built the agent as a glass box. One purchase produces about **25 auditable events**, a **100-point score** where every point is explained, and **one human signature** before any money moves." |
| 4 | 0:50–1:05 | **9-step loop** | Nodes light up in sequence; ledger blocks fill | "Every mission runs a nine-step loop: perceive, recall, govern, source, verify, rank, mandate, act, learn. Each step appends a SHA-256 hash-chained event. The same engine runs on the server *and* entirely in your browser, with zero dependencies." |
| 5 | 1:05–1:25 | **Reliable context** | Two cards + adjusted-rating bar fills | "It knows you. I never told it I wear glasses; it **remembered** and required glasses-friendly headphones. I returned narrow Kestrel shoes, so it won't pick Kestrel again. And it doesn't fall for tricks: a 4.8-star product with **46% fake reviews** gets rejected, a **$199 bait** offer from a flagged merchant gets ignored, and a price **12% above its 30-day average** gets flagged." |
| 6 | 1:25–1:45 | **Safe action** | Mandate card; Approve button pulses | "When it's ready to buy, it stops and drafts a **spending mandate**: item, merchant, max amount, a 15-minute expiry, and a content-addressed ID. Persona verifies a real human signed it. At checkout it **re-checks the live price** and aborts on any bait-and-switch. Cancelling appends a refund to the ledger; nothing is ever deleted." |
| 7 | 1:45–2:05 | **The ledger** | Chain animates; one block turns red, then the chain after it | "Here's the part I love. Every event is hashed with the previous one, and you verify it **in your own browser** with WebCrypto. If someone edits one price after the fact, the chain breaks **at exactly that event**. In the app it's one click: *Simulate tampering*." |
| 8 | 2:05–2:25 | **Sponsor stack** | 11 partner tiles cascade | "Every partner has a real job in the loop: **Senso** for trusted context, **Airbyte** for merchant data, **cognee** for memory, **Superlinked** for semantic ranking, **Arcee** for small-model reasoning, **Statsig** for guardrail flags, **Persona** for human verification, **SingleStore** for the ledger, **Amplitude** for agent analytics, and **Firedrill** and **Guild** for drills and evaluation. Every call is itself written to the ledger." |
| 9 | 2:25–2:45 | **Proof** | Six metric tiles pop in | "And it works: **10 out of 10** adversarial safety drills pass, **24 out of 24** end-to-end API checks pass, zero dependencies, and every decision is explainable point by point." |
| 10 | 2:45–3:00 | **Vision** | Closing line + roadmap pills | "Next: signed mandates on real agentic-commerce checkouts, plus an independent auditor agent. Our belief is simple: **if an agent can spend your money, it should show you its receipts.** Thank you. Glassbox is live at vnmoorthy.github.io/glassbox." |

---

## 10-minute live demo run-sheet (if you get demo time)

1. **Hero (0:00):** "What should I buy for you, Alex?" Point at the green classification banner: sandbox data, no real payments.
2. **Run the headphones mission (0:30):** click the chip *Noise-cancelling headphones for long flights under $300*, then **Run agent**.
   - Narrate the trace as it streams: *Recalled what I know about you* (glasses), *Loaded guardrails*, *Queried 5 merchants*.
   - Point at the red **Rejected: Beatline X Pro**: never-buy brand and 46% fake reviews.
   - Point at the partner tags on each step (SENSO, COGNEE, SUPERLINKED SIE, STATSIG, PERSONA…).
3. **Recommendation (2:00):** score ring 83, the "why" bullets, and the spec tags. Scroll to **Every option considered**: the stacked score bars, and the ⚠ price-spike flag on Sonance.
4. **Choose a different option (3:00):** click **Choose this instead** on Hushwave. The mandate is revoked and re-issued with a new ID, and that's on the ledger too. Switch back if you like.
5. **Approve & buy (4:00):** the Persona step and live price re-check appear in the trace; the order is confirmed and the receipt is sealed. Click **Download receipt**.
6. **Audit ledger (5:00):** click **Verify integrity** (all green, VERIFIED). Click **Simulate tampering**: BREACH at the exact event, red from there down. **Restore original**. Click any block to open the evidence drawer with raw JSON and hashes.
7. **Refusals (6:30):** run *Espresso machine under $200* (refuses to break your rules), then *Buy me something nice* (asks instead of guessing).
8. **Memory & rules (7:30):** set **Max per order** to 100 and save. Re-run headphones: the guardrail fails and the mandate shows it needs an explicit override. Click **Reset demo profile**.
9. **Safety drills (8:30):** **Run all drills**: 10/10, 100% safety score, with Firedrill and Guild tiles.
10. **Sponsor stack (9:15):** 11 adapters, each with its pipeline step, env keys and last call. **Ping all integrations**. Close with **Orders → Cancel** to show the refund appended to the chain.
