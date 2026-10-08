import base64, json, os
os.environ["ROOFRIGHT_STORE"] = "memory"
os.environ["ROOFRIGHT_AGENT"] = "rules"

from api import handlers as h

PAYLOAD = dict(society_name="Green Apts", city="Delhi", num_houses=40, roof_area_m2=400, sanctioned_load_kw=30,
               monthly_units_kwh=3000, tariff_inr_per_kwh=8, shading_pct=10, is_society=True,
               roof_right="society_common", consent_pct=70, structural_ok=True)


def call(fn, body=None, **params):
    return fn({"httpMethod": "POST", "body": json.dumps(body) if body is not None else None, "pathParameters": params}, None)


def test_health():
    r = h.health({}, None)
    assert r["statusCode"] == 200 and json.loads(r["body"])["ok"]


def test_case_lifecycle_and_documents():
    r = call(h.create_case, PAYLOAD)
    assert r["statusCode"] == 200
    case = json.loads(r["body"])
    assert case["policy"]["ready_to_apply"] and case["result"]["system_kwp"] > 0
    got = json.loads(call(h.get_case, id=case["id"])["body"])
    assert got["id"] == case["id"]
    docs = json.loads(call(h.documents, id=case["id"])["body"])
    assert set(docs["files"]) == {"consent-resolution", "vendor-rfq"}
    f = call(h.file_download, id=case["id"], name="vendor-rfq.pdf")
    assert f["isBase64Encoded"] and base64.b64decode(f["body"]).startswith(b"%PDF")


def test_blockers_surface_in_case():
    r = json.loads(call(h.create_case, {**PAYLOAD, "roof_right": "disputed", "consent_pct": 20})["body"])
    gates = {b["gate"] for b in r["policy"]["blockers"]}
    assert {"CheckRoofRight", "CheckConsent"} <= gates


def test_bad_input_is_400():
    assert call(h.size, {"monthly_units_kwh": -1, "tariff_inr_per_kwh": 8, "roof_area_m2": 10})["statusCode"] == 400
    assert call(h.size, {"nope": 1})["statusCode"] == 400


def test_chat_rule_fallback():
    case = json.loads(call(h.create_case, {**PAYLOAD, "consent_pct": 10})["body"])
    r = json.loads(call(h.chat, {"case_id": case["id"], "message": "what is blocking us?"})["body"])
    assert r["engine"] == "rules" and "consent" in r["answer"].lower()


def test_unknown_case_404():
    assert call(h.get_case, id="nope")["statusCode"] == 404
