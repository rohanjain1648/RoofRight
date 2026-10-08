# RoofRight — Design Specification

Track: **Waste and Energy** (rooftop solar). Stack: **Build It (local, AWS open source)**.
Author: solo builder. Status: approved for build.

## 1. Goal

Get an apartment society from "we're curious about solar" to a **submission-ready application pack in 5 minutes**.
The pack covers: system sizing, subsidy, payback, the RWA consent resolution and a vendor RFQ.

### Problem evidence
- Only ~22.7% of PM Surya Ghar applications become installations; blockers are financing, vendor capacity and approvals (IEEFA).
- Apartment blocks stall on roof rights (e.g. ~60,000 CHB flats in Chandigarh) and RWA consent.
- Households find the process complex and rely on vendors for information; regional-language outreach is thin.

### Users
RWA secretary, treasurer, or a resident champion. Mobile-first, Hindi + English, low patience for forms.

### Success criteria
1. A stranger can upload a bill, confirm values, and download consent + RFQ PDFs in under 5 minutes.
2. Every number on screen is reproducible by the deterministic engine and states its assumptions.
3. The 3-minute video visibly shows Strands, SAM CLI, LocalStack and Cedar running.
4. One flow that works end to end beats five that almost do.

## 2. AWS open-source pieces (all must be visible in the demo)

| Tool | Role |
|---|---|
| **Strands Agents SDK** | Core agent. Tools: `extract_bill`, `size_system`, `calc_subsidy`, `check_policy`, `draft_consent`, `draft_rfq`. Answers "what's blocking us?" grounded in case data. |
| **SAM CLI + Lambda** | Backend API, run with `sam local start-api`. |
| **LocalStack** | Local S3 (bill uploads, generated PDFs) and DynamoDB (cases). |
| **Cedar** | Policy checks: roof-right gate, consent gate, structural gate, load gate; who may approve/submit. |
| Corretto | Skipped (YAGNI) unless a Java component is added. |

## 3. Model strategy (local constraint)

Strands defaults to Bedrock, which needs an account. Locally: Strands' **Ollama provider**.
- **Vision model** reads the bill photo. **Text model** powers the chat agent.
- Bill extraction has a fallback chain: Ollama vision (structured output) -> Tesseract OCR + regex -> manual entry.
- The user always sees extracted values with a per-field confidence and can edit them. The model is never trusted blindly.
- **The LLM never does math.** Sizing, subsidy, payback and CO2 are deterministic Python.
- Model id is env-configurable (`ROOFRIGHT_VISION_MODEL`, `ROOFRIGHT_TEXT_MODEL`), so Bedrock can be swapped in later without code change.

## 4. Data flow

1. User uploads a bill photo and picks/draws the roof area on a Leaflet map.
2. Extraction returns units, tariff, sanctioned load (editable, confidence shown).
3. Deterministic engine: roof area -> kWp, generation, subsidy, payback, CO2e.
4. Cedar evaluates roof-rights, consent, structural and load gates -> blockers with fixes.
5. PDFs (consent resolution, vendor RFQ) generated and stored in LocalStack S3.
6. Dashboard shows the pack, payback chart, blockers and the chat agent.

## 5. Architecture

```
frontend (Vite + React + TypeScript, i18next EN/HI, Leaflet, Recharts)
   |  HTTP
API (SAM local -> Python Lambda handlers)  <- dev_server.py adapter for fast iteration
   |-- engine/sizing.py      deterministic sizing, subsidy, payback, CO2e
   |-- engine/policy.py      Cedar (cedarpy) gate evaluation
   |-- engine/documents.py   PDF generation (reportlab)
   |-- engine/bill.py        bill extraction (Ollama vision -> OCR -> manual)
   |-- engine/agent.py       Strands agent + tools
   |-- api/store.py          LocalStack DynamoDB + S3 (in-memory fallback)
LocalStack (Docker): S3, DynamoDB
```

## 6. API contract

| Method | Path | Purpose |
|---|---|---|
| GET | /health | liveness + which store is active |
| POST | /bill/extract | `{image_base64}` -> `{fields, confidence, method}` |
| POST | /size | sizing only (live preview while editing inputs) |
| POST | /cases | size + Cedar gates + persist -> case |
| GET | /cases/{id} | fetch case |
| POST | /cases/{id}/documents | generate PDFs -> `{files}` |
| GET | /files/{id}/{name} | download PDF |
| POST | /chat | `{case_id, message}` -> `{answer, tool_calls}` |

## 7. Domain rules

### Sizing
- usable area = roof area x usable fraction (0.6) x (1 - shading)
- kWp = min(roof capacity at 10 m2/kWp, demand-based size, sanctioned load)
- generation = kWp x city yield (kWh/kWp/yr)
- payback uses tariff escalation (3%) and panel degradation (0.5%/yr) over 25 years; savings capped at consumption.

### Subsidy (PM Surya Ghar) — versioned in `backend/engine/config/subsidy.json`
- Individual: Rs. 30,000/kW for first 2 kW, Rs. 18,000 for the 3rd kW, cap Rs. 78,000.
- RWA/GHS common facilities: Rs. 18,000/kW, up to 3 kW per house, 500 kW total.
- **All values UNVERIFIED until checked against pmsuryaghar.gov.in.** The UI shows "subsidy unverified" until `retrieved` is set.

### Cedar gates
| Gate | Rule |
|---|---|
| CheckRoofRight | permit society_common or owner_exclusive; forbid disputed |
| CheckConsent | permit consent >= 51% |
| CheckStructural | permit structural certificate present |
| CheckLoad | permit sanctioned load >= system kWp |
| ApproveResolution | secretary only, consent >= 51% |
| SubmitApplication | secretary/owner, consent >= 51%, roof not disputed |

Each failed gate maps to a human "how to fix it" message.

## 8. UX requirements
- Mobile-first, single-column wizard: Bill -> Roof -> Society -> Results -> Pack.
- Hindi/English toggle for all UI strings and PDFs' headings.
- Editable extracted values, visible assumptions panel, plain-language blockers.
- Loading, empty, error states everywhere; works with keyboard; readable contrast.

## 9. Correctness & risk register
| Risk | Mitigation |
|---|---|
| Subsidy numbers wrong | Config file + source URL + "unverified" badge; verify before submission |
| Vision model misreads bill | Confidence + editable fields + OCR fallback + manual entry |
| Model unavailable/slow | Deterministic flow works without any LLM; chat degrades to rule-based answers |
| SAM/Docker friction | dev_server.py adapter runs the same handlers; SAM used for the demo |
| Scope creep | Cut list below |

## 10. Non-goals
Auth, payments, live vendor integrations, satellite roof detection, DISCOM API integration.

## 11. Deliverables for submission
Public repo, README (problem, build, AWS integration, AI tools used, credits/licences), YouTube demo < 3 min
showing Strands + SAM + LocalStack + Cedar, short writeup.

## 12. Cut list (if behind)
1. Payback chart polish 2. Chat agent LLM (keep rule-based) 3. Hindi PDFs 4. Map drawing (keep numeric roof input).
