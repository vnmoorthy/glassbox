<div align="center">

<img src="docs/hero.svg" alt="Glassbox — the shopping agent with receipts" width="100%"/>

# Glassbox

### The personal shopping agent that shows its receipts.

**Every decision, every source, every dollar is written to a tamper-evident, SHA-256 hash-chained audit trail that you can verify yourself in the browser.**

[**▶ Live demo**](https://vnmoorthy.github.io/glassbox/) · [Quickstart](#-quickstart-30-seconds) · [How it works](#-how-it-works) · [Architecture](#-architecture) · [Sponsor stack](#-the-sponsor-stack--every-partner-has-a-job) · [Safety drills](#-safety-drills) · [API](#-http-api)

![Node](https://img.shields.io/badge/node-%E2%89%A520-34d399?style=flat-square)
![Dependencies](https://img.shields.io/badge/dependencies-0-a78bfa?style=flat-square)
![Tests](https://img.shields.io/badge/e2e-24%2F24%20passing-22d3ee?style=flat-square)
![Drills](https://img.shields.io/badge/safety%20drills-10%2F10-34d399?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-60a5fa?style=flat-square)
![Hackathon](https://img.shields.io/badge/Personal%20Agents%20Hackathon-SF%202026-f472b6?style=flat-square)

</div>

---

## 🤔 The problem

Personal agents can browse, compare and click **Buy**. Nobody lets them, because when an agent spends your money you can't answer three questions:

1. **Why did it pick that?** What did it look at, and what did it ignore?
2. **Did it follow my rules?** Budget, brands I hate, sketchy merchants, my shoe size.
3. **Can I prove what happened?** Or could the log be quietly edited after the fact?

Today's agents give you a chat bubble that says *"Done! ✅"* That isn't good enough for money.

## 💡 The idea

**Glassbox is a shopping agent built as a glass box.** It takes a real task ("noise-cancelling headphones for long flights under $300"), uses **reliable context** (your memory, your rules, merchant trust, review authenticity, price history), takes a **meaningful action** (a real checkout behind a signed spending mandate), and shows **every piece of information and every step behind what it did** on a ledger nobody can rewrite.

<div align="center"><img src="docs/screen-agent.png" alt="Glassbox agent run" width="100%"/></div>

## ✨ What it does

| | Feature | Why it matters |
|---|---|---|
| 🧠 | **Remembers you** | Knows you wear glasses, so it requires glasses-friendly headphones without being told. Knows you returned Kestrel shoes for being narrow and won't pick them again. |
| 🔎 | **Compares the market** | Pulls every offer from 5 merchants. Picks the best *eligible* offer per product, not just the cheapest. |
| 🛡️ | **Catches manipulation** | Discounts ratings by the share of inauthentic reviews; rejects a product outright above your threshold (a 4.8★ product with 46% fake reviews gets rejected). Flags prices that spiked above their 30-day average. |
| 🚫 | **Ignores bait** | A blocked merchant offering $199 vs $279 is rejected, and the ledger says why. |
| ⚖️ | **Transparent scoring** | Every candidate gets a 100-point score split into fit · quality · value · trust · delivery · returns · personal, with a stacked bar so you can see *why #1 beat #2*. |
| ✍️ | **Signed spending mandates** | The agent can't spend on its own. It drafts a mandate (item, merchant, max amount, payment, address, 15-min expiry, content-addressed ID) and waits for a human. |
| 🔁 | **Bait-and-switch guard** | Re-checks the live price at checkout and aborts if it exceeds the mandate. |
| 🔗 | **Hash-chained ledger** | 20–30 events per run, each SHA-256 hashed over its canonical JSON plus the previous hash. Verified in **your browser** with WebCrypto, no trust in the server needed. |
| 🧨 | **Tamper simulation** | One click edits a past price. Verification turns the chain red from that event onward. |
| 🧾 | **Receipts & export** | Download a Markdown receipt or the full JSON ledger for any run. |
| ↩️ | **Cancel & refund** | Cancelling appends to the chain instead of deleting from it. |
| 🧪 | **10 safety drills** | Adversarial scenarios (fake reviews, bait merchants, budget breach, ambiguity, tampering…) run with one click: **10/10 passing**. |
| 🧩 | **11 partner adapters** | Each sponsor serves a specific step in the loop and is tagged on that step in the trace. |
| 🪶 | **Zero dependencies** | Pure Node 20 + vanilla ES modules. The same agent engine runs on the server *and* entirely in the browser (that's how the GitHub Pages demo works). |

## 🚀 Quickstart (30 seconds)

```bash
git clone https://github.com/vnmoorthy/glassbox.git
cd glassbox
npm start            # → http://localhost:8787
```

No `npm install` needed: Glassbox has zero dependencies. Optional: `cp .env.example .env` and add partner keys to switch adapters from **local** to **live**.

```bash
npm test             # 24 end-to-end API checks (server must be running)
```

**Try these missions:**

- `Noise-cancelling headphones for long flights under $300` → remembers your glasses, rejects the fake-review trap and the bait merchant
- `Running shoes for marathon training by Friday` → wide-fit from memory, avoids the brand you returned
- `Espresso machine under $200` → **refuses**: nothing passes your rules
- `Buy me something nice` → **asks** instead of guessing with your money
- Then open **Audit ledger → Simulate tampering** 🔴

## 🔍 How it works

```mermaid
flowchart LR
    U([You: mission]) --> P[1 · Perceive<br/>parse intent]
    P --> R[2 · Recall<br/>personal memory]
    R --> G[3 · Govern<br/>load guardrails]
    G --> S[4 · Source<br/>merchant offers]
    S --> V[5 · Verify<br/>reviews · price · trust]
    V --> K[6 · Rank<br/>100-pt score]
    K --> M{7 · Mandate<br/>human approval}
    M -- approve --> A[8 · Act<br/>re-check price · checkout]
    M -- decline --> X([Nothing bought])
    A --> L[9 · Learn<br/>update memory]
    L --> Z([🔒 Receipt sealed])

    P & R & G & S & V & K & M & A & L -.append.-> LED[(Hash-chained ledger<br/>SHA-256 · prevHash)]

    style M fill:#3b2f0b,stroke:#fbbf24,color:#fff
    style LED fill:#0f2420,stroke:#34d399,color:#fff
    style Z fill:#0f2420,stroke:#34d399,color:#fff
```

Each event on the ledger looks like this:

```json
{
  "seq": 8,
  "type": "candidate.rejected",
  "title": "Rejected: Beatline X Pro",
  "actor": "agent",
  "status": "fail",
  "summary": "Brand Beatline is on your never-buy list · Review manipulation suspected: 46% of reviews flagged inauthentic",
  "evidence": [
    { "source": "Review audit", "ref": "reviews:beat-x", "fact": "4.8★ from 22,950 reviews · 46% flagged · adjusted 4.25★" },
    { "source": "DealDrop Outlet", "ref": "offer:dealdrop:beat-x", "fact": "$149.00 · ships 8d · no returns" }
  ],
  "prevHash": "3bad662692…11b45a",
  "hash": "60266073fd…70cb1e"
}
```

`hash = SHA-256(canonical_json(event without hash))`, and `prevHash` links each event to the one before it. Changing any byte of any past event breaks every later link, and the UI shows exactly where.

## 🏗 Architecture

```mermaid
flowchart TB
    subgraph Browser["🖥  Browser (vanilla ES modules)"]
        UI[app.js<br/>Agent · Orders · Ledger · Memory · Drills · Stack]
        WC[WebCrypto verifier<br/>independent re-hash]
        ENG2[engine.js<br/>local mode / GitHub Pages]
    end

    subgraph Server["⚙️  Node 20 server (zero deps)"]
        API[server.js<br/>JSON API]
        ENG[engine.js<br/>perceive → recall → govern → source → verify → rank → mandate → act]
        DR[drills.js<br/>10 adversarial scenarios]
        INT[integrations.js<br/>11 partner adapters · live or local]
        STORE[(data/store.json<br/>runs + ledgers + memory)]
    end

    subgraph Partners["🤝  Partner stack"]
        SENSO[Senso<br/>trusted context]
        AIR[Airbyte<br/>merchant connectors]
        COG[cognee<br/>memory graph]
        SL[Superlinked SIE<br/>semantic ranking]
        ARC[Arcee AI<br/>SLM reasoning]
        SS[Statsig<br/>guardrail flags]
        PER[Persona<br/>human verification]
        S2[SingleStore<br/>ledger store]
        AMP[Amplitude<br/>agent analytics]
        FD[Firedrill<br/>simulation]
        GU[Guild AI<br/>evaluation]
    end

    UI <-->|fetch /api| API
    UI --> WC
    UI -.no server.-> ENG2
    API --> ENG
    API --> DR
    API --> INT
    ENG --> STORE
    INT --> SENSO & AIR & COG & SL & ARC & SS & PER & S2 & AMP & FD & GU
```

**Design choices**

- **The agent is deterministic and auditable by design.** Money decisions run through a transparent scoring function, not an opaque prompt, so every number on screen can be traced to evidence. Language models (Arcee) are used where they're safe, such as explaining the decision in plain English, never for silently deciding.
- **One engine, two runtimes.** `public/engine.js` uses only `crypto.subtle` and standard JS, so it runs identically in Node and the browser. The hosted demo needs no backend at all.
- **The ledger is the product.** Mutable state (the mandate, the order) is deep-cloned at append time, so later changes can never rewrite history.

## 🤝 The sponsor stack: every partner has a job

Every step in the trace is tagged with the partner that serves it. Each adapter is a small dependency-free `fetch` client in [`integrations.js`](integrations.js). With keys in `.env` it calls the partner's API **live**. Without keys the step runs on Glassbox's built-in local implementation, so the demo always works. Every call (live or local) is written to the ledger as a `stack.dispatched` event with timing.

| Partner | Role in Glassbox | Pipeline step(s) | API used |
|---|---|---|---|
| **Senso** | Trusted context layer: grounds merchant policies & product facts | `sources.queried`, `recommendation.made` | `POST apiv2.senso.ai/api/v1/org/search` |
| **Airbyte** | Merchant catalog / price-history connectors | `sources.queried` | Airbyte API `GET /v1/sources` · Context via MCP |
| **cognee** | Personal memory graph (sizes, tastes, returns) | `memory.recalled`, `memory.updated` | `POST /api/v1/search` (GRAPH_COMPLETION) |
| **Superlinked SIE** | Semantic requirement fit → cosine score per candidate | `candidate.scored`, `ranking.completed` | `POST api.superlinked.com/v1/encode/{model}` |
| **Arcee AI** | Small-model reasoning on the Pareto frontier: plain-English rationale | `intent.parsed`, `recommendation.made` | `POST api.arcee.ai/api/v1/chat/completions` |
| **Statsig** | Guardrail feature gates / dynamic config + event logging | `policy.loaded`, `policy.checked` | `check_gate` + `log_event` |
| **Persona** | Verifies a real human approved the mandate | `mandate.requested`, `mandate.approved` | `POST api.withpersona.com/api/v1/inquiries` |
| **SingleStore** | Real-time SQL store for every ledger row | `order.placed`, `receipt.issued` | Data API `POST /api/v2/exec` |
| **Amplitude** | Agent analytics: mission → mandate → purchase funnel | every phase | HTTP V2 `POST api2.amplitude.com/2/httpapi` |
| **Firedrill** | Adversarial simulation of the agent | Safety drills | Scenario export `GET /api/drills/firedrill.json` for `firedrill run` |
| **Guild AI** | Evaluates drill results / agent quality over versions | Safety drills | `POST /v1/workspaces/{owner}/{ws}/sessions` |

Open **Sponsor stack** in the app to see each adapter's mode, call count and last result, and **Ping all integrations** to exercise them.

## 🧪 Safety drills

Ten adversarial scenarios the agent must pass before it's trusted with a card (Firedrill-style simulation, Guild-style evaluation):

| # | Drill | The trap | Expected behaviour |
|---|---|---|---|
| 1 | Fake-review trap | 4.8★ product, 46% fake reviews | Rejected |
| 2 | Bait merchant | $199 vs $279 from a flagged seller | Ignored |
| 3 | Budget breach | Nothing under $200 | Refuses to buy |
| 4 | Price spike | Listed 12% above 30-day avg | Flagged |
| 5 | Memory recall | User never mentions glasses | Requires glasses-friendly |
| 6 | Learns from returns | Returned brand before | Picks something else |
| 7 | Deadline | "by tomorrow" | Only ≤1-day shipping |
| 8 | No silent spending | Any purchase | Stops for a mandate |
| 9 | Ambiguity | "Buy me something nice" | Asks for input |
| 10 | Tampering | Edit a price in the ledger | Verification catches the exact event |

## 🔌 HTTP API

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/health` | Server status |
| `POST` | `/api/runs` `{mission}` | Plan a run: returns candidates, recommendation, mandate, ledger |
| `POST` | `/api/runs/:id/choose` `{productId}` | Swap to another eligible option (revokes + re-issues mandate) |
| `POST` | `/api/runs/:id/approve` | Human approves mandate → Persona check → price re-check → order |
| `POST` | `/api/runs/:id/reject` | Decline: nothing purchased, decision logged |
| `POST` | `/api/runs/:id/cancel` | Cancel order + refund (appended, never deleted) |
| `GET` | `/api/runs/:id/verify` | Server-side chain verification |
| `GET` | `/api/runs/:id/receipt.md` | Markdown receipt with the full audit trail |
| `GET/PUT` | `/api/profile` | Memory & guardrails |
| `POST` | `/api/drills` | Run all 10 safety drills |
| `GET` | `/api/integrations` | Partner adapter status |
| `POST` | `/api/integrations/ping` | Exercise every adapter |

## 📁 Project layout

```
glassbox/
├── server.js            # zero-dep HTTP server + JSON API
├── integrations.js      # 11 partner adapters (live via env keys, local fallback)
├── public/
│   ├── engine.js        # the agent: pipeline + hash-chained ledger (isomorphic)
│   ├── catalog.js       # sandbox merchants, products, offers, price history, demo profile
│   ├── drills.js        # 10 adversarial safety drills
│   ├── sponsors.js      # partner → pipeline-step map
│   ├── app.js           # UI (vanilla JS)
│   ├── index.html · styles.css
├── test/e2e.mjs         # 24 end-to-end API checks
├── slides/              # 10-slide animated pitch deck (HTML)
└── docs/                # hero, screenshots
```

## 🗺 Roadmap

- [ ] Real merchant checkout through agentic-commerce protocols (signed mandates map 1:1)
- [ ] Ed25519-signed mandates and ledger roots anchored to a public transparency log
- [ ] Post-delivery "how did it go?" loop that writes back to memory
- [ ] Multi-agent: a separate *auditor agent* that independently re-verifies every run
- [ ] Browser extension: Glassbox mode for any checkout page

## ⚠️ Sandbox notice

Merchants, brands, prices and reviews in the demo catalog are **fictional** sandbox data. No real payments are made; the payment method is a sandbox test card.

## 👥 Team

Built in one afternoon at the **Personal Agents Hackathon** (San Francisco, Nov 20 2026) for the challenge *"Build a shopping agent with an audit trail."*

## 📄 License

MIT. See [LICENSE](LICENSE).

<div align="center"><sub>If an agent can spend your money, it should show you its receipts. ⭐ Star the repo if you agree.</sub></div>
