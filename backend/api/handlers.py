"""Lambda handlers (API Gateway proxy format). Run via `sam local start-api` or dev_server.py."""
from __future__ import annotations
import base64, json
from engine.sizing import SizingInput, size_system
from engine.policy import evaluate
from engine.documents import consent_resolution, vendor_rfq
from engine.finance import finance_options, lifecycle
from engine.consent import record_vote, tally
from . import store

CORS = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "*"}
CASE_FIELDS = ("id", "society_name", "city", "num_houses", "roof_area_m2", "sanctioned_load_kw", "monthly_units_kwh",
               "tariff_inr_per_kwh", "shading_pct", "is_society", "roof_right", "consent_pct", "structural_ok")


def _resp(code: int, body, ctype: str = "application/json", b64: bool = False):
    if ctype == "application/json":
        body = json.dumps(body)
    return {"statusCode": code, "headers": {**CORS, "Content-Type": ctype}, "body": body, "isBase64Encoded": b64}


def _body(event) -> dict:
    raw = event.get("body") or "{}"
    if event.get("isBase64Encoded"):
        raw = base64.b64decode(raw).decode()
    return json.loads(raw)


def _preflight(event) -> bool:
    return event.get("httpMethod") == "OPTIONS"


def health(event, _ctx=None):
    return _resp(200, {"ok": True, "store": store.backend_name()})


def bill_extract(event, _ctx=None):
    if _preflight(event):
        return _resp(204, "")
    from engine.bill import extract_bill
    try:
        img = base64.b64decode(_body(event)["image_base64"])
    except Exception:
        return _resp(400, {"error": "image_base64 required"})
    return _resp(200, extract_bill(img))


def _size(b: dict) -> dict:
    load = float(b["sanctioned_load_kw"]) if b.get("sanctioned_load_kw") else None
    return size_system(SizingInput(
        monthly_units_kwh=float(b["monthly_units_kwh"]), tariff_inr_per_kwh=float(b["tariff_inr_per_kwh"]),
        roof_area_m2=float(b["roof_area_m2"]), city=b.get("city", "default"),
        shading_pct=float(b.get("shading_pct", 10)), sanctioned_load_kw=load,
        is_society=bool(b.get("is_society", True)), num_houses=int(b.get("num_houses", 1))))


def size(event, _ctx=None):
    if _preflight(event):
        return _resp(204, "")
    try:
        return _resp(200, _size(_body(event)))
    except (KeyError, ValueError) as e:
        return _resp(400, {"error": f"invalid input: {e}"})


def create_case(event, _ctx=None):
    """Create a case: sizing + Cedar gates, persisted."""
    if _preflight(event):
        return _resp(204, "")
    b = _body(event)
    try:
        result = _size(b)
    except (KeyError, ValueError) as e:
        return _resp(400, {"error": f"invalid input: {e}"})
    case = {k: b[k] for k in CASE_FIELDS if b.get(k) is not None}
    case["result"] = {k: v for k, v in result.items() if k != "cumulative_series"}
    case["series"] = result["cumulative_series"]
    case["policy"] = evaluate({**case, "system_kwp": result["system_kwp"]}, role=b.get("role", "secretary"))
    case["role"] = b.get("role", "secretary")
    case["consent_source"] = "estimate"
    case["finance"] = finance_options(result, int(case.get("num_houses", 1)))
    case["lifecycle"] = lifecycle(result)
    return _resp(200, store.save_case(case))


def get_case(event, _ctx=None):
    if _preflight(event):
        return _resp(204, "")
    c = store.get_case((event.get("pathParameters") or {}).get("id", ""))
    return _resp(200, c) if c else _resp(404, {"error": "case not found"})


def documents(event, _ctx=None):
    if _preflight(event):
        return _resp(204, "")
    cid = (event.get("pathParameters") or {}).get("id", "")
    c = store.get_case(cid)
    if not c:
        return _resp(404, {"error": "case not found"})
    result = {**c["result"], "cumulative_series": c.get("series", [])}
    files = {}
    for name, fn in (("consent-resolution", consent_resolution), ("vendor-rfq", vendor_rfq)):
        store.put_file(f"{cid}/{name}.pdf", fn(c, result))
        files[name] = f"/files/{cid}/{name}.pdf"
    return _resp(200, {"files": files, "store": store.backend_name()})


def file_download(event, _ctx=None):
    if _preflight(event):
        return _resp(204, "")
    p = event.get("pathParameters") or {}
    data = store.get_file(p.get("id", "") + "/" + p.get("name", ""))
    if not data:
        return _resp(404, {"error": "file not found"})
    return _resp(200, base64.b64encode(data).decode(), "application/pdf", b64=True)


def chat(event, _ctx=None):
    if _preflight(event):
        return _resp(204, "")
    from engine.agent import answer
    b = _body(event)
    c = store.get_case(b.get("case_id", ""))
    if not c:
        return _resp(404, {"error": "case not found"})
    return _resp(200, answer(c, b.get("message", "")))


def vote(event, _ctx=None):
    """A resident records agreement (or not) for their flat; consent and Cedar gates update."""
    if _preflight(event):
        return _resp(204, "")
    cid = (event.get("pathParameters") or {}).get("id", "")
    c = store.get_case(cid)
    if not c:
        return _resp(404, {"error": "case not found"})
    b = _body(event)
    if not isinstance(b.get("agree"), bool):
        return _resp(400, {"error": "agree must be true or false"})
    try:
        record_vote(c, str(b.get("flat", "")), b["agree"], role=c.get("role", "secretary"))
    except ValueError as e:
        return _resp(400, {"error": str(e)})
    store.save_case(c)
    return _resp(200, {"tally": tally(c), "policy": c["policy"], "consent_pct": c["consent_pct"]})


def public_case(event, _ctx=None):
    """What a resident sees on the vote page: no votes list, just the proposal and the tally."""
    if _preflight(event):
        return _resp(204, "")
    c = store.get_case((event.get("pathParameters") or {}).get("id", ""))
    if not c:
        return _resp(404, {"error": "case not found"})
    r = c["result"]
    fin = c.get("finance") or {}
    return _resp(200, {
        "id": c["id"], "society_name": c.get("society_name"), "city": c.get("city"),
        "system_kwp": r["system_kwp"], "net_cost_inr": r["net_cost_inr"], "subsidy_inr": r["subsidy_inr"],
        "year1_savings_inr": r["year1_savings_inr"], "payback_years": r["payback_years"],
        "co2_avoided_tonnes_per_year": r["co2_avoided_tonnes_per_year"],
        "net_cost_per_flat_inr": fin.get("net_cost_per_flat_inr"),
        "monthly_saving_per_flat_inr": fin.get("monthly_saving_per_flat_inr"),
        "tally": tally(c),
    })
