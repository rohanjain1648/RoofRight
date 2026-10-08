"""Lambda handlers (API Gateway proxy format). Run via `sam local start-api` or dev_server.py."""
from __future__ import annotations
import base64, json
from engine.sizing import SizingInput, size_system
from engine.policy import evaluate
from engine.documents import consent_resolution, vendor_rfq
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
