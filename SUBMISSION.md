# Submission: paste-ready fields

**Project name:** Glassbox

**Tagline / short description (≤300 chars):**
Glassbox is a personal shopping agent with receipts. It remembers you, compares real offers, catches fake reviews and bait prices, asks for your signed approval before spending, and writes every step to a tamper-evident hash-chained audit trail you can verify in your browser.

**What does it do, and for whom? (≤1,500 chars):**
For anyone who wants an agent to shop for them but can't trust a black box with their card.

Give Glassbox a task like "noise-cancelling headphones for long flights under $300". It runs a 9-step loop: parse intent, recall your memory (it knows you wear glasses and that you returned narrow Kestrel shoes), load your guardrails, pull offers from 5 merchants, and verify each one: ratings discounted for fake reviews (a 4.8★ product with 46% fake reviews is rejected), price-spike detection against 30-day history, merchant trust, and delivery deadline. It then ranks options on a 100-point score where every point is explained.

It never spends silently. It drafts a signed spending mandate (item, merchant, max amount, 15-min expiry) and waits for you. Persona verifies a human approved it, the live price is re-checked to stop bait-and-switch, and the order is placed.

Every step, with its evidence, is appended to a SHA-256 hash-chained ledger. Verify it in-browser with WebCrypto; one click simulates tampering and shows the exact broken event. It passes 10/10 adversarial safety drills. Partners: Senso (context), Airbyte (merchant data), cognee (memory), Superlinked SIE (ranking), Arcee (reasoning), Statsig (guardrails), Persona (human verification), SingleStore (ledger store), Amplitude (analytics), Firedrill and Guild (drills and evals).

**Team:** 1 — Just me

**Tools / tech partners to select (all 11 + host):**
Cognee · Senso.ai · Amplitude + Statsig · Superlinked · Guild AI · Airbyte · Arcee AI · Firedrill · SingleStore · Persona · Tokens&
Also add: Node.js · WebCrypto · JavaScript · Claude Code

**Working project URL:** https://vnmoorthy.github.io/glassbox/

**Demo video link:** upload `slides/Glassbox-Pitch-3min.mp4` (or a Loom screen recording of the 10-minute run-sheet in `slides/SCRIPT.md`) to YouTube (Unlisted), Loom or Google Drive ("Anyone with the link"), then paste the link.

**Repository:** https://github.com/vnmoorthy/glassbox

**Screenshot to upload:** `docs/screen-agent.png` (370 KB PNG)

**Additional project details (optional):**
Zero-dependency Node 20 + vanilla ES modules; the same agent engine runs on the server and fully in the browser (that's the GitHub Pages demo). Run locally with `npm start` → http://localhost:8787. Test suite: `npm test` (24/24 e2e checks). Pitch deck: https://vnmoorthy.github.io/glassbox/slides/ (also slides/Glassbox-Pitch.pptx and .pdf in the repo). Partner adapters switch from local to live when keys are added to .env (see .env.example). Demo catalog uses fictional merchants and brands; no real payments.
