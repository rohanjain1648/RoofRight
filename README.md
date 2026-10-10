# RoofRight

**From electricity bill to solar application pack, in minutes.**
A rooftop-solar desk for Indian housing societies, built for the *Waste and Energy* track of Environmental Hacks (Bharat Builds Tour, Event 02) on the AWS open-source stack.

> Demo video: `[YouTube link]` · Blog: `[AWS Builder Center link]`

<!-- IMAGE: hero screenshot of the results screen with the roof panel array -->

## Table of contents

1. [The problem](#the-problem)
2. [The solution](#the-solution)
3. [What makes this different](#what-makes-this-different)
4. [Features](#features)
5. [User journey](#user-journey)
6. [System architecture](#system-architecture)
7. [Request flow, step by step](#request-flow-step-by-step)
8. [Data model and state](#data-model-and-state)
9. [Tech stack](#tech-stack)
10. [AI deep dive](#ai-deep-dive)
11. [How AWS open source is used](#how-aws-open-source-is-used)
12. [Design principles](#design-principles)
13. [Impact](#impact)
14. [Real-world use cases](#real-world-use-cases)
15. [How this compares to existing approaches](#how-this-compares-to-existing-approaches)
16. [Scalability](#scalability)
17. [Responsible AI](#responsible-ai)
18. [How this maps to the judging criteria](#how-this-maps-to-the-judging-criteria)
19. [Trade-offs and what was cut](#trade-offs-and-what-was-cut)
20. [Installation and setup](#installation-and-setup)
21. [API reference](#api-reference)
22. [Testing](#testing)
23. [Important caveats](#important-caveats)
24. [Future scope](#future-scope)
25. [FAQ](#faq)
26. [AI tools used](#ai-tools-used)
27. [Credits and licences](#credits-and-licences)

---

## The problem

India's rooftop solar subsidy, PM Surya Ghar: Muft Bijli Yojana, has plenty of interest but a weak conversion rate. Reported figures show only about 22.7% of applications become completed installations, with financing, vendor capacity and approvals named as the main blockers ([IEEFA](https://ieefa.org/resources/residential-rooftop-solar-grows-under-pm-surya-ghar-yojana-gaps-persist)).

Apartment societies face an extra wall that an individual homeowner does not:

- **Nobody clearly owns the roof.** Is it common property, or does one top-floor owner control it? In some housing boards that single question stalls tens of thousands of flats ([Tribune, Chandigarh](https://www.tribuneindia.com/news/chandigarh/rwas-flag-roof-right-hurdle-blocking-solar-adoption-in-60000-chb-flats)).
- **The general body has to consent.** A system on common property needs a resolution, usually a majority vote, before anyone can sign a vendor contract.
- **One volunteer has to turn all of it into paperwork.** The secretary — unpaid, usually with a day job — has to work out system size, cost, subsidy eligibility, and then write the resolution and the vendor brief from scratch, in a format vendors and the general body will both accept.

None of this is a technology problem in the deep-tech sense. It is a *first-document* problem: nothing moves until somebody produces the first draft, and today nobody has the time or the domain knowledge to produce it quickly.

## The solution

**RoofRight turns an electricity bill into a decision-ready document pack.** A secretary or a resident champion opens the app on a phone, answers five short screens, and leaves with:

- A sized system (kWp), with its generation, subsidy, payback and CO₂ impact, stated with its assumptions.
- A plain-language list of exactly what is blocking the application today, and how to clear each blocker.
- A consent resolution, formatted for the general body, with the numbers already filled in.
- A vendor request-for-quotation, with the technical scope already specified.
- A chat assistant that can answer "what's blocking us?" at 11pm without waiting for a committee meeting.

The target is not a perfect engineering design. It is turning a blank page into a draft, which is the actual bottleneck.

## What makes this different

Most hackathon projects in this space are either (a) a generic waste-sorting image classifier, or (b) informal-recycling marketplaces — both are crowded; multiple Smart India Hackathon 2026 teams built near-identical "Kabadiwala Connect" platforms for e-waste collectors. RoofRight instead targets the *documented, measured* 77% gap between solar interest and solar installation, with a workflow nobody else in the search results had: society-specific policy gates plus auto-generated governance paperwork, not just a sizing calculator.

Three choices make it distinct:

1. **The roof you actually have, not a generic number.** The results screen draws the real roof and tiles it with the exact panel count, so "6.6 kWp" becomes something a non-technical committee can picture and argue about.
2. **Blockers, not just numbers.** Most solar calculators stop at payback period. RoofRight evaluates approval gates — roof rights, consent threshold, structural sign-off, sanctioned load — as formal Cedar policies and tells the user precisely what is stopping them and how to fix it.
3. **The model is kept away from the money.** Every rupee figure on screen comes from deterministic, unit-tested Python. The LLM reads bills and explains results through tools; it never originates a number.

## Features

| Area | What it does |
|---|---|
| Bill reading | Upload a photo → Strands agent + local vision model extracts units, tariff, sanctioned load, with a confidence score per field and an editable form |
| Fallback chain | Vision model → Tesseract OCR + regex parser → manual entry; the app works with zero AI available |
| Roof capture | Tap corners on a Leaflet map to draw the terrace outline; area computed by a local equirectangular shoelace-formula projection, or type the number directly |
| Sizing engine | Deterministic calculation of system size (roof-, demand- or load-limited), annual generation by city irradiance, 25-year payback with tariff escalation and panel degradation, and CO₂ avoided |
| Subsidy calculator | Individual and RWA/GHS (housing-society) subsidy slabs from a versioned, source-linked config file, with an on-screen "unverified" warning until checked |
| Policy gates | Four Cedar-evaluated gates (roof rights, consent ≥51%, structural certificate, sanctioned load) plus two Cedar-evaluated permissions (who can approve, who can submit), each with a plain-language fix |
| Document generation | Two print-ready PDFs — a general-body consent resolution and a vendor RFQ — built with reportlab and populated from the case data |
| Storage | Cases in DynamoDB, PDFs in S3, both via LocalStack; falls back to in-process memory automatically if LocalStack is unreachable |
| Chat agent | A Strands agent with tools (`get_case_summary`, `check_blockers`, `what_if_size`, `what_if_consent`) answers grounded questions about the case; falls back to a rule-based answerer if the model is unavailable |
| 3D Roof Studio | The society's building in three.js (react-three-fiber): panels laid out in south-facing rows with shade-safe spacing, a rooftop water tank casting real shadows, and the sun placed for the city, month and hour (declination and hour-angle formulae). A live clear-sky kW readout and a day curve follow the sun |
| Consent Drive | One shareable link (with a WhatsApp share message in English or Hindi). Residents vote by flat number; consent is recomputed from votes and the Cedar consent gate re-evaluated on every vote. One vote per flat, validated flat ids, voter list never exposed publicly |
| Per-flat economics and funding | One-time cost per flat, monthly saving per flat, and a side-by-side of society funds vs public-sector bank loan vs NBFC loan (EMI, interest, saving minus EMI) |
| End-of-life plan | Panel count and mass to recycle after 25 years, recoverable mass, lifetime CO₂, and take-back clauses that are written into the vendor RFQ PDF — the *waste* half of the track |
| Landing page | White, end-to-end product story with a live 3D building as the hero |
| Bilingual UI | Every string, including blockers and PDFs' headings, is available in English and Hindi via i18next, with a one-tap toggle persisted locally |
| Accessibility & responsiveness | Mobile-first layout, visible keyboard focus, `prefers-reduced-motion` respected, dark-mode token set, 48px minimum tap targets |

## User journey

```
 ┌─────────┐   ┌─────────┐   ┌──────────┐   ┌─────────┐   ┌────────┐
 │  Bill   │──▶│  Roof   │──▶│ Society  │──▶│ Results │──▶│  Pack  │
 └─────────┘   └─────────┘   └──────────┘   └─────────┘   └────────┘
 photo in       map tap        5 fields       panels on      2 PDFs +
 → fields out   → m² out       + role         your roof      chat
 (editable)                                   + blockers
```

1. **Bill** — upload a photo of a recent electricity bill. The extracted units, tariff and sanctioned load appear in editable fields; anything below 80% confidence is visually flagged and the user is asked to double-check it. A "use a sample bill" shortcut exists for demos and for users without a bill handy.
2. **Roof** — pick a city (sets the solar-yield assumption), then tap 3+ points on the map to trace the terrace; the polygon area is computed live. A numeric override and a shading percentage are always available alongside the map.
3. **Society** — name, flat count, percentage of members who have already agreed, who holds the right to the roof (society / one owner with NOC / disputed / unsure), whether a structural certificate exists, and the user's own role (secretary / owner / resident) — the role matters because Cedar's permission checks differ by role.
4. **Results** — the roof redrawn with the exact panel count; six key figures (cost, subsidy, net cost, year-1 savings, payback, CO₂); a blockers list with fixes; a 25-year cumulative-savings chart; a permissions table; and a collapsible assumptions panel.
5. **Pack** — one button generates both PDFs, each downloadable immediately. Below that, a chat box answers follow-up questions, each answer tagged with which engine produced it (`strands+ollama` or `rules`) and which tools were called.

## System architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Frontend — Vite + React + TypeScript                         │
│ i18next (EN/HI) · Leaflet (map) · Recharts (payback chart)   │
│ src/api.ts — typed fetch client, single source of API shapes │
└───────────────────────────────┬──────────────────────────────┘
                                 │ HTTP (JSON, API-Gateway-proxy shape)
┌───────────────────────────────▼──────────────────────────────┐
│ API layer — identical handlers, two runners                  │
│  • sam local start-api   (template.yaml, real Lambda runtime)│
│  • dev_server.py          (stdlib HTTP server, same handlers)│
│  backend/api/handlers.py  — routes → engine calls → response │
└───────────────────────────────┬──────────────────────────────┘
                                 │
        ┌────────────────────────┼────────────────────────┐
        ▼                        ▼                        ▼
┌───────────────┐      ┌──────────────────┐      ┌──────────────────┐
│ engine/sizing  │      │ engine/policy     │      │ engine/bill       │
│ deterministic  │      │ Cedar (cedarpy)   │      │ Strands + Ollama  │
│ math, config-  │      │ gates + perms     │      │ vision → OCR →    │
│ driven         │      │                   │      │ manual fallback   │
└───────────────┘      └──────────────────┘      └──────────────────┘
        │                                                   │
        ▼                                                   ▼
┌───────────────┐                                  ┌──────────────────┐
│ engine/        │                                  │ engine/agent      │
│ documents      │                                  │ Strands chat      │
│ reportlab PDFs │                                  │ agent + 4 tools   │
└───────┬───────┘                                  └──────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────┐
│ api/store.py — LocalStack (S3 + DynamoDB) or in-memory        │
│ auto-detects LocalStack; falls back silently if unreachable   │
└──────────────────────────────────────────────────────────────┘
```

**Why two API runners?** `sam local start-api` runs the actual Lambda handlers inside a Docker-based Lambda runtime — this is what the demo video shows, because it is the part the judging rubric explicitly asks to see. `dev_server.py` serves the *same* handler functions over a plain stdlib HTTP server, with no Docker dependency, so the frontend can be developed and tested quickly. There is exactly one implementation of business logic; only the transport differs.

## Request flow, step by step

Walking through what happens when a user finishes the Society step and clicks "Build my solar pack":

1. The frontend POSTs the collected bill, roof and society fields to `POST /cases`.
2. `handlers.create_case` validates the payload and calls `engine.sizing.size_system`, a pure function that computes system size (capped by roof area, electricity demand, and sanctioned load, whichever binds first), annual generation, subsidy, a 25-year cumulative-savings series, and CO₂ avoided.
3. The same handler calls `engine.policy.evaluate`, which builds a Cedar entity from the case and the computed system size, and issues six separate Cedar authorization requests — one per gate/permission — against `policy/roofright.cedar`.
4. The combined result (sizing + policy) is written through `api/store.save_case`, which tries LocalStack DynamoDB first and transparently falls back to an in-process dict if LocalStack cannot be reached within a 1-second connect timeout.
5. The case, including an id, is returned to the frontend, which advances to the Results screen with no further network calls — everything needed to render is already in the response.
6. On the Pack screen, `POST /cases/{id}/documents` re-reads the case, renders two PDFs with `engine.documents`, and writes them to S3 (or memory) under `{case_id}/{name}.pdf`; the response gives the frontend download URLs served by `GET /files/{id}/{name}`.
7. A chat message `POST /chat` loads the case, builds four tools closed over that specific case (so the model can only compute for this society), and invokes a local Strands agent; if the model call fails for any reason, `engine.agent.rule_based_answer` produces a grounded answer from the same case data with no LLM involved.

## Data model and state

RoofRight deliberately keeps state in two tiers:

- **Durable, shared state** — one case per society application, stored as a single DynamoDB item (or an in-memory dict entry when running without LocalStack): inputs, the full sizing result, the 25-year series, and the policy evaluation. Generated PDFs are separate S3 objects keyed by case id, so they can be regenerated without re-running the sizing engine.
- **Ephemeral, client-side state** — the in-progress wizard (which step, draft field values, map points) lives only in React state. Nothing is persisted until the user reaches the end of the Society step and a case is created server-side. This means a half-filled form is never silently saved somewhere the user can't see, and a fresh page load always starts a clean case.

No authentication layer exists (see [Trade-offs](#trade-offs-and-what-was-cut)) — a case id is effectively a capability token for the demo's purposes.

## Tech stack

**Frontend:** React 19, TypeScript, Vite, i18next + react-i18next, Leaflet + react-leaflet, Recharts. No CSS framework — handwritten tokens-based CSS with light/dark support.

**Backend:** Python 3.12, AWS SAM CLI (Lambda handlers, API Gateway proxy integration), Strands Agents SDK (+ Ollama provider), cedarpy (Cedar policy engine), boto3 (talks to LocalStack), reportlab (PDF generation), pydantic (structured output schema), pytesseract + Pillow (OCR fallback), pytest.

**Infrastructure (local):** Docker + LocalStack (S3, DynamoDB), Ollama (local model runtime).

**Models:** Qwen 2.5 (3B) for chat/reasoning, Qwen 2.5-VL (3B) for bill-image reading — both small enough to run on a laptop CPU/GPU, swappable via `ROOFRIGHT_TEXT_MODEL` / `ROOFRIGHT_VISION_MODEL` environment variables, with a documented path to Amazon Bedrock for production.

## AI deep dive

RoofRight uses AI in exactly two places, and both are deliberately narrow.

**1. Bill extraction (`engine/bill.py`).** A `BillFields` pydantic model defines four optional numeric fields. A Strands agent, backed by a local Ollama vision model, is invoked with the bill image and asked to populate that schema via `structured_output_model`. The result is passed through `validate()`, which range-checks every field (for example, sanctioned load must be between 0.5 and 500 kW) and zeroes out anything implausible rather than passing it through. If the vision call raises for any reason (model not pulled, Ollama not running, bad image), the code falls through to a Tesseract OCR pass, whose raw text is parsed by a hand-written regex extractor (`parse_bill_text`) tuned to common Indian electricity-bill phrasing ("Units Consumed", "Sanctioned Load", "Net Amount Payable"). OCR-derived values are additionally confidence-discounted by 20%, since OCR is less reliable than a vision model for this task. If both fail, the API still returns a well-formed response — an empty form with a clear message — so the UI never breaks on a bad photo.

**2. The chat agent (`engine/agent.py`).** The agent is given four tools, each a closure over one specific case, so it can only read or compute values for the society currently open — there is no way for it to answer about a different case, and no way for it to free-associate a number that didn't come from a tool call. The system prompt explicitly instructs it to call tools for every fact and never guess, and to flag unverified subsidy figures. If the model call fails, `rule_based_answer()` runs instead: a small set of keyword-matched templates (block/stuck/why → list blockers; subsidy → subsidy figures; payback/savings → financial figures; anything else → a general summary) built directly from the same Cedar evaluation and sizing result the LLM path would have used. The chat UI shows which path answered (`engine: "strands+ollama"` or `engine: "rules"`), so nothing is hidden from the user about how an answer was produced.

**What AI is never allowed to do:** compute system size, generation, cost, subsidy amount, payback period, or CO₂ figures. All of those are pure Python in `engine/sizing.py`, covered by unit tests for roof-limited, demand-limited and sanctioned-load-limited cases, and for the subsidy slab boundaries. This was a conscious design decision (see [Design principles](#design-principles)) — a wrong number here is a trust-destroying failure in a tool meant to be shown to a general body deciding whether to spend lakhs of rupees.

## How AWS open source is used

Each of these is runtime infrastructure, not a label — every one of them is exercised by the running app and visible in the demo.

| Tool | Role | Where in the repo |
|---|---|---|
| **Strands Agents SDK** | Powers both the bill-reading tool call and the chat agent's four tools (`get_case_summary`, `check_blockers`, `what_if_size`, `what_if_consent`) | `backend/engine/agent.py`, `backend/engine/bill.py` |
| **AWS SAM CLI** | Defines the eight Lambda functions and their API Gateway routes; `sam local start-api` runs the actual serverless backend | `backend/template.yaml` |
| **LocalStack** | Provides local S3 (generated PDFs) and DynamoDB (case records), started by one `docker compose up -d` | `docker-compose.yml`, `backend/api/store.py` |
| **Cedar** | Evaluates every approval gate and permission as a formal authorization policy, not hand-rolled if/else logic | `backend/policy/roofright.cedar`, `backend/engine/policy.py` |

Models run locally through Strands' Ollama provider, so the project needs no AWS account, no credit card and no bill — true to the hackathon's "Build It" track. The model id is an environment variable (`ROOFRIGHT_VISION_MODEL`, `ROOFRIGHT_TEXT_MODEL`), so switching to a Bedrock-hosted model for production is a configuration change, not a rewrite.

## Design principles

- **The model never does the maths.** Sizing, subsidy, payback and CO₂ are deterministic Python with unit tests. The LLM only reads bills and explains results, and it does so by calling tools, not by generating numbers itself.
- **Nothing is trusted blindly.** Every extracted bill value is shown for human confirmation before use; low-confidence fields are visually flagged. If the vision model fails, the system falls back to OCR, then to manual entry. If the chat model is unavailable, a rule-based answerer explains the case from the same underlying data.
- **Assumptions are visible, not buried.** Sunshine yield by city, usable-roof fraction, shading, installed cost per kWp, tariff escalation and panel degradation are all shown in a collapsible panel on the results screen, next to the numbers they produced.
- **Policy is data, not code.** Approval rules live in a Cedar policy file, not scattered across the codebase as conditionals — a real society's by-laws (a different consent threshold, an extra sign-off) can be changed by editing the policy, not the application.
- **Every AI step has a non-AI fallback that still produces a usable result.** The app is fully usable — sizing, policy gates, document generation — with zero models running; AI only improves the entry points (reading a bill photo, answering a free-text question).

## Impact

RoofRight is aimed squarely at the documented 77%+ gap between solar interest and solar installation among Indian households ([IEEFA](https://ieefa.org/resources/residential-rooftop-solar-grows-under-pm-surya-ghar-yojana-gaps-persist)), and specifically at the apartment-society segment of that gap, where roof-rights disputes have been reported to block tens of thousands of flats in a single city alone ([Tribune](https://www.tribuneindia.com/news/chandigarh/rwas-flag-roof-right-hurdle-blocking-solar-adoption-in-60000-chb-flats)).

If a tool like this removes even the "nobody knows where to start" friction for a meaningful share of societies that stall at that stage, the downstream effect compounds: more grid-connected rooftop solar reduces both household electricity bills and grid-level fossil generation — RoofRight's own CO₂-avoided figure (computed from the grid emission factor in `subsidy.json`) is shown on every results screen specifically so a society can see that number for its own case.

`[Fill in with any real numbers you gather: societies you showed this to, their estimated system size and CO₂ avoided, any feedback quotes. Do not estimate a city- or country-wide impact number — the honest claim is "this removes friction for the cases we tested," not a macro projection.]`

## Real-world use cases

- **An RWA secretary** who has been asked "can we go solar?" at three consecutive meetings and has no answer beyond "let me find out," uses RoofRight to walk in with numbers and a resolution draft.
- **A resident champion** without committee authority uses the Results screen to make the case to their secretary, backed by a document rather than an opinion.
- **A vendor-facing NGO or installer** could use the generated RFQ as a structured first-contact brief instead of an unstructured phone call, reducing the vendor's own back-and-forth.
- **A society with a disputed roof** gets an explicit, actionable answer — "get a common-property declaration or an owner NOC" — instead of the conversation dying on an unresolved question.

## How this compares to existing approaches

| | Generic solar calculators | Waste/e-waste marketplace apps (e.g. "Kabadiwala Connect"-style SIH projects) | RoofRight |
|---|---|---|---|
| Output | A single payback number | A collector-recycler matching platform | A full decision-ready pack: numbers + governance documents |
| Society governance (consent, roof rights) | Not addressed | Not applicable | Modelled explicitly as Cedar policy gates |
| Competitive crowding at this hackathon | Common | Very common (multiple near-identical SIH 2026 entries found in research) | Narrow, under-addressed angle within "Waste and Energy" |
| What's blocking you | Not shown | Not shown | Explicit list with fixes |
| Works without any AI | N/A (usually no AI) | Varies | Yes — sizing, policy and documents all work offline |

## Scalability

The architecture is deliberately serverless-shaped so that moving from "local demo" to "real deployment" is a configuration change, not a rewrite:

- `template.yaml` already describes every endpoint as an independent Lambda function behind API Gateway; deploying to real AWS is `sam deploy` once AWS credentials are available.
- `api/store.py` already targets DynamoDB and S3 through a standard boto3 client with a configurable endpoint — pointing `AWS_ENDPOINT_URL` at real AWS (or removing it) is the only change needed to move off LocalStack.
- The sizing and policy engines are pure, stateless functions — they scale horizontally for free under Lambda's concurrency model.
- The one component that would need real thought at scale is the chat agent's local-model dependency; the model id being an environment variable means swapping `OllamaModel` for a Bedrock-backed Strands model is the documented upgrade path (see [AI deep dive](#ai-deep-dive)).

## Responsible AI

- **No financial or legal number is ever produced by a language model.** This is the project's central responsible-AI commitment, enforced structurally (tools return engine output; the LLM cannot bypass them) rather than by prompt instruction alone.
- **Confidence is surfaced, not hidden.** Bill-reading confidence per field, and which engine (model vs. rules) answered a chat question, are both shown in the UI.
- **Unverified data is labelled as such.** Subsidy amounts carry a `retrieved` field; until it is set after checking the official portal, the UI shows an explicit "unverified" warning rather than presenting a government subsidy figure as confirmed.
- **Graceful degradation is a first-class requirement, not an afterthought.** Every AI-touched feature (bill reading, chat) has a deterministic or rule-based fallback that still produces a correct, if less convenient, result.
- **No PII beyond what the user chooses to submit** (a bill photo, a society name) is collected; there is no account system, and in the local/demo configuration nothing leaves the user's machine except model calls to the locally-running Ollama instance.

## How this maps to the judging criteria

| Criterion | How RoofRight addresses it |
|---|---|
| Idea and impact | Targets a specific, sourced, documented gap (solar interest vs. installation, apartment roof-rights disputes) rather than a generic "waste sorting" demo |
| Built on AWS | Four AWS open-source tools (Strands, SAM, LocalStack, Cedar) are load-bearing runtime infrastructure, demonstrated running in the video, not named only in the writeup |
| Design and usability | Five-screen mobile-first wizard, bilingual (EN/HI) throughout, plain-language blockers with fixes, visible assumptions, accessible focus states and reduced-motion support |
| Execution | One flow works end to end: bill photo → sized system → policy gates → two generated PDFs → grounded chat. Deterministic core is unit tested (`backend/tests`, 20 tests) |
| Demo video | Scripted to under 3 minutes with every AWS tool visibly exercised; see `docs/DEMO_SCRIPT.md` |

## Trade-offs and what was cut

Built in a time-boxed hackathon window, so some things were deliberately left out rather than half-built:

- **No authentication.** A case id is a bearer token for the demo. A real deployment needs Cognito-backed accounts scoped to a society.
- **No live vendor or DISCOM integration.** The RFQ is a document, not an API call to actual vendors; net-metering submission to the DISCOM is still manual.
- **No satellite roof detection.** The user draws the roof by hand on a map; this is simpler and more reliable for a 4-day build than a computer-vision roof-segmentation model, and it keeps the human in the loop for something that affects a real financial decision.
- **Small local models, not Bedrock.** Chosen so the project needs zero AWS account and zero spend, per the "Build It" track rules; accuracy on bill photos is correspondingly lower than a frontier hosted model would give, which is exactly why the OCR and manual fallbacks exist and are not cosmetic.
- **Subsidy figures need manual verification.** They are config, not hardcoded, specifically so this can be fixed without touching code — but as shipped they are explicitly marked unverified rather than silently presented as correct.

## Installation and setup

### Prerequisites

- Node.js 20+
- Python 3.12
- Docker (for LocalStack and for `sam local`)
- [Ollama](https://ollama.com) (for local models; optional — see fallbacks above)

### Steps

```bash
# 1. LocalStack (S3 + DynamoDB)
docker compose up -d

# 2. Local models
ollama pull qwen2.5:3b        # chat agent
ollama pull qwen2.5vl:3b      # bill reading (optional; falls back to OCR/manual)

# 3. Backend
cd backend
python -m venv .venv && .venv\Scripts\activate      # source .venv/bin/activate on macOS/Linux
pip install -r requirements.txt
pytest                                               # 28 tests
sam local start-api --env-vars env.json              # the demo path (needs Docker)
# or, faster while developing (same handlers, no Docker needed):
python dev_server.py 3000

# 4. Frontend
cd ../frontend
npm install
npm run dev                                          # http://localhost:5173
```

### Configuration

| Variable | Default | Purpose |
|---|---|---|
| `ROOFRIGHT_STORE` | auto-detect | Set to `memory` to skip LocalStack entirely |
| `ROOFRIGHT_AGENT` | `auto` | Set to `rules` to force the no-LLM chat fallback |
| `ROOFRIGHT_VISION_MODEL` | `qwen2.5vl:3b` | Ollama model id for bill reading |
| `ROOFRIGHT_TEXT_MODEL` | `qwen2.5:3b` | Ollama model id for the chat agent |
| `OLLAMA_HOST` | `http://localhost:11434` | Ollama server address |
| `AWS_ENDPOINT_URL` | `http://localhost:4566` | LocalStack endpoint; point at real AWS to deploy for real |
| `VITE_API` (frontend) | `http://localhost:3000` | API base URL |

## API reference

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | Liveness check; reports which storage backend is active |
| `POST` | `/bill/extract` | `{image_base64}` → `{fields, confidence, method, notes}` |
| `POST` | `/size` | Sizing only, no persistence — used for live previews |
| `POST` | `/cases` | Full case: sizing + Cedar policy evaluation, persisted |
| `GET` | `/cases/{id}` | Fetch a stored case |
| `POST` | `/cases/{id}/documents` | Generate both PDFs for a case → `{files}` |
| `GET` | `/files/{id}/{name}` | Download a generated PDF |
| `POST` | `/cases/{id}/votes` | `{flat, agree}` → updated tally, consent % and Cedar policy |
| `GET` | `/public/{id}` | Resident-facing proposal summary and tally (no voter list) |
| `POST` | `/chat` | `{case_id, message}` → `{answer, engine, tool_calls}` |

## Testing

`backend/tests` (28 tests, all passing as of the last local run) covers:

- **`test_sizing.py`** — subsidy slab boundaries (individual and society), roof-limited vs. demand-limited vs. sanctioned-load-limited sizing, and rejection of invalid input.
- **`test_policy.py`** — all-clear case, a disputed roof blocking the relevant gates and permissions, a non-secretary being denied approval rights, and multiple simultaneous blockers.
- **`test_documents.py`** — both generated PDFs are valid, non-trivial PDF files.
- **`test_bill.py`** — the regex bill parser against a realistic sample bill, implausible-value rejection, and that extraction never raises even on garbage input.
- **`test_finance.py`** — EMI against a known table value, per-flat split and funding-route ordering, end-of-life maths, votes flipping the Cedar consent gate, re-votes replacing earlier votes, and rejection of malformed flat ids and over-voting.
- **`test_api.py`** — the full case lifecycle (create → fetch → generate documents → download a PDF), blockers surfacing correctly end to end, 400s on bad input, the chat rule-based fallback, and 404 on an unknown case.

The frontend is checked with `tsc -b` (strict TypeScript) and a production `vite build`; both pass cleanly.

`[Fill in after an end-to-end browser run: which sample bills were tried, how bill reading performed with the vision model running, and how long the full flow took from upload to downloaded PDFs.]`

## Important caveats

- **Subsidy figures are unverified.** They live in `backend/engine/config/subsidy.json` with a source URL and a `retrieved` field. Until that field is set after checking [pmsuryaghar.gov.in](https://pmsuryaghar.gov.in), the UI shows an "unverified" warning. Do not rely on the amounts.
- Sizing is an estimate for planning, not an engineering design. A licensed structural engineer and an empanelled vendor are still required.
- Roof area comes from what the user draws; there is no satellite roof detection.
- Generated documents are drafts for a general body meeting, not legal advice.

## Future scope

- Society-specific Cedar policy packs — upload your by-laws, get your own consent threshold and sign-off rules without a code change.
- A Bedrock-backed vision model option for higher-accuracy bill reading in a deployed (non-local) configuration.
- Cognito-backed accounts so a society can save and return to a case, and a secretary can share it with co-committee members.
- A lightweight vendor directory, so the RFQ can be sent directly rather than only downloaded.
- A shared, anonymised dashboard letting neighbouring societies compare typical system sizes and payback in their city.

## FAQ

**Does this replace a solar installer or a structural engineer?** No. It produces a planning-grade estimate and a governance draft; final design and safety sign-off still require licensed professionals.

**Does it work without an internet connection?** The core flow (sizing, policy, document generation) needs no internet once dependencies are installed, since models and storage run locally. The map tiles currently come from OpenStreetMap over the network.

**What happens if the AI models aren't running?** Everything still works. Bill reading falls back to OCR, then manual entry; chat falls back to a rule-based answerer built from the same case data.

**Why Cedar instead of just writing `if` statements?** Because the rules belong to the society, not the programmer. Keeping them as a separate, readable policy file means a different consent threshold or an extra approval step is a one-line policy edit, not a code change and redeploy.

**Is this specific to one city or utility?** Solar-yield assumptions are provided for ten major Indian cities with a documented default; the subsidy slabs follow the national PM Surya Ghar scheme rather than a state-specific one.

## AI tools used

Built with **Claude Code** (Anthropic) for code generation and review; all output was reviewed and tested by the author. Runtime models: Qwen 2.5 and Qwen 2.5-VL via Ollama.

## Credits and licences

Open-source libraries: Strands Agents SDK, AWS SAM CLI, LocalStack, cedarpy (Cedar), boto3, reportlab, pydantic, React, Vite, Leaflet and react-leaflet, Recharts, i18next. Map tiles © OpenStreetMap contributors. Fonts: Bricolage Grotesque and Hind (SIL Open Font License). Each retains its own licence; see the respective packages.

---

*Built for Environmental Hacks, Bharat Builds Tour Event 02, October 2026.*
