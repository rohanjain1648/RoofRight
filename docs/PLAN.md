# RoofRight — Implementation Plan

Legend: [x] done, [ ] todo. Verify each step by running tests / the real flow before ticking.

## Phase 0 — Environment
- [x] Node 22, Python 3.12, Docker, Java 22 present
- [ ] backend venv: strands-agents[ollama], cedarpy, aws-sam-cli, boto3, reportlab, pytest, pytesseract, pillow (installing)
- [ ] Ollama running with a vision model (e.g. qwen2.5vl) and a text model (e.g. qwen2.5)
- [ ] LocalStack container up (`docker compose up -d`)
- [ ] Tesseract binary (optional; OCR fallback)

## Phase 1 — Deterministic core (tests first)
- [x] engine/config/subsidy.json
- [x] engine/sizing.py + tests
- [x] engine/policy.py + policy/roofright.cedar + tests
- [x] engine/documents.py + tests
- [ ] Run and pass all backend tests

## Phase 2 — API
- [x] api/store.py (LocalStack + in-memory fallback)
- [x] api/handlers.py
- [ ] dev_server.py adapter (routes -> handlers)
- [ ] template.yaml for SAM; env.json for local
- [ ] docker-compose.yml (LocalStack)
- [ ] API integration tests (handlers, both stores)

## Phase 3 — AI layer
- [ ] engine/bill.py: schema, Ollama vision via Strands, OCR fallback, confidence
- [ ] engine/agent.py: Strands agent + tools wrapping engine functions; rule-based fallback
- [ ] Tests with mocked model; manual test with real bills

## Phase 4 — Frontend (React + TS)
- [ ] Design tokens, layout, i18n (EN/HI)
- [ ] Wizard: Bill upload -> Roof map -> Society -> Results -> Pack
- [ ] Results: KPIs, assumptions, payback chart, Cedar blockers
- [ ] PDF download, chat panel, error/loading/empty states
- [ ] Typecheck + build clean

## Phase 5 — Integration & demo readiness
- [ ] Run whole stack: LocalStack + SAM local + Ollama + frontend; walk the flow in a browser
- [ ] Seed demo case + sample bills
- [ ] Verify subsidy numbers against official portal; set `retrieved`
- [ ] README (problem, build, AWS integration, AI tools, credits/licences)
- [ ] Demo script (3 min) showing Strands, SAM, LocalStack, Cedar

## Definition of done
Full flow works locally from a fresh start with documented commands; all tests pass; typecheck and build pass;
README and demo script exist.
