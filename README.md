# RoofRight

**From electricity bill to solar application pack, in minutes.**
A rooftop-solar desk for Indian housing societies, built for the *Waste and Energy* track of Environmental Hacks (Bharat Builds Tour, Event 02) on the AWS open-source stack.

> Demo video: `[YouTube link]` · Blog: `[AWS Builder Center link]`

<!-- IMAGE: hero screenshot of the results screen with the roof panel array -->

## The problem

India's rooftop solar subsidy (PM Surya Ghar) has plenty of interest but few installations. Reported figures show only about 22.7% of applications become completed installations, with financing, vendor capacity and approvals as the blockers ([IEEFA](https://ieefa.org/resources/residential-rooftop-solar-grows-under-pm-surya-ghar-yojana-gaps-persist)). Apartment societies have an extra wall: nobody clearly owns the roof, the general body has to consent, and the secretary has to turn all of it into paperwork. In some housing boards that stalls tens of thousands of flats ([Tribune](https://www.tribuneindia.com/news/chandigarh/rwas-flag-roof-right-hurdle-blocking-solar-adoption-in-60000-chb-flats)).

RoofRight targets that one gap: getting a society from "we're curious" to a document pack it can take to its general body meeting.

## What it does

1. **Bill** — upload an electricity bill photo. It is read for units, rate and sanctioned load. You confirm or edit every value; low-confidence values are highlighted.
2. **Roof** — tap the corners of the terrace on a map (area is computed), or type the area. Set shading.
3. **Society** — flats, consent so far, who has roof rights, structural certificate, your role.
4. **Results** — system size drawn as panels on your roof, cost, subsidy, payback, CO₂ avoided, and a plain-language list of what blocks the application and how to fix each item.
5. **Pack** — a consent resolution and a vendor quotation request as PDFs, plus a chat agent that answers "what is blocking us?".

English and Hindi throughout, mobile-first.

## How AWS open source is used

| Tool | What it does here | Where |
|---|---|---|
| **Strands Agents SDK** | Chat agent with tools over the deterministic engine; bill reading via a vision model with structured output | `backend/engine/agent.py`, `backend/engine/bill.py` |
| **AWS SAM CLI** | Runs the Lambda handlers as an API locally (`sam local start-api`) | `backend/template.yaml` |
| **LocalStack** | Local S3 (generated PDFs) and DynamoDB (cases) | `docker-compose.yml`, `backend/api/store.py` |
| **Cedar** | Policy engine for the approval gates (roof rights, consent, structural, load) and who may approve or submit | `backend/policy/roofright.cedar`, `backend/engine/policy.py` |

Models run locally through Strands' Ollama provider, so no AWS account or bill is needed. The model id is an environment variable, so a Bedrock model can be swapped in without code changes.

## Design principles

- **The model never does the maths.** Sizing, subsidy, payback and CO₂ are deterministic Python with tests. The LLM only reads the bill and explains results, and it does so through tools.
- **Nothing is trusted blindly.** Extracted values are always shown for confirmation. If vision fails, it falls back to OCR, then to manual entry. If the chat model is down, a rule-based answerer explains the case from the same data.
- **Assumptions are visible.** Yield by city, usable roof fraction, shading, cost, tariff rise and panel ageing are listed on the results screen.
- **Policy is data, not code.** Approval rules live in Cedar, so a society's real by-laws can be changed without touching the app.

## Architecture

```
frontend (Vite + React + TypeScript, i18next EN/HI, Leaflet, Recharts)
   │ HTTP
API  (SAM local → Python Lambda handlers | dev_server.py runs the same handlers)
   ├─ engine/sizing.py      sizing, subsidy, payback, CO₂e
   ├─ engine/policy.py      Cedar gate evaluation (cedarpy)
   ├─ engine/documents.py   PDF generation (reportlab)
   ├─ engine/bill.py        Strands + Ollama vision → OCR → manual
   ├─ engine/agent.py       Strands agent and tools, rule-based fallback
   └─ api/store.py          LocalStack DynamoDB + S3 (in-memory fallback)
```

<!-- IMAGE: architecture diagram -->

## Run it

Prerequisites: Node 20+, Python 3.12, Docker, [Ollama](https://ollama.com).

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
pytest                                               # 20 tests
sam local start-api --env-vars env.json              # the demo path (needs Docker)
# or, faster while developing (same handlers, no Docker needed):
python dev_server.py 3000

# 4. Frontend
cd ../frontend
npm install
npm run dev                                          # http://localhost:5173
```

Useful environment variables: `ROOFRIGHT_STORE=memory` (skip LocalStack), `ROOFRIGHT_AGENT=rules` (skip the LLM), `ROOFRIGHT_VISION_MODEL`, `ROOFRIGHT_TEXT_MODEL`, `OLLAMA_HOST`, `AWS_ENDPOINT_URL`.

## Important caveats

- **Subsidy figures are unverified.** They live in `backend/engine/config/subsidy.json` with a source URL and a `retrieved` field. Until that field is set after checking [pmsuryaghar.gov.in](https://pmsuryaghar.gov.in), the UI shows an "unverified" warning. Do not rely on the amounts.
- Sizing is an estimate for planning, not an engineering design. A licensed structural engineer and an empanelled vendor are still required.
- Roof area comes from what the user draws; there is no satellite roof detection.
- Generated documents are drafts for a general body meeting, not legal advice.

## Testing

`backend/tests` covers sizing (roof-, demand- and load-limited cases, subsidy caps), Cedar gates, PDF validity, the bill parser (including garbage input), and the API lifecycle. The frontend is checked with `tsc` and a production build.

`[Fill in after the end-to-end run: what was tested in a browser, on which sample bills, with which models.]`

## AI tools used

Built with **Claude Code** (Anthropic) for code generation and review; all output was reviewed and tested by the author. Runtime models: Qwen 2.5 and Qwen 2.5-VL via Ollama.

## Credits and licences

Open-source libraries: Strands Agents SDK, AWS SAM CLI, LocalStack, cedarpy (Cedar), boto3, reportlab, pydantic, React, Vite, Leaflet and react-leaflet, Recharts, i18next. Map tiles © OpenStreetMap contributors. Fonts: Bricolage Grotesque and Hind (SIL Open Font License). Each retains its own licence; see the respective packages.

