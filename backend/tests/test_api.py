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


def test_finance_lifecycle_on_case():
    case = json.loads(call(h.create_case, PAYLOAD)["body"])
    assert case["finance"]["flats"] == 40 and len(case["finance"]["options"]) == 3
    assert case["lifecycle"]["panels"] > 0


def test_vote_endpoint_flips_gate_and_public_view():
    case = json.loads(call(h.create_case, {**PAYLOAD, "num_houses": 3, "consent_pct": 0})["body"])
    assert any(b["gate"] == "CheckConsent" for b in case["policy"]["blockers"])
    for flat in ("A-1", "A-2"):
        r = call(h.vote, {"flat": flat, "agree": True}, id=case["id"])
        assert r["statusCode"] == 200
    out = json.loads(r["body"])
    assert out["consent_pct"] == 67 and not any(b["gate"] == "CheckConsent" for b in out["policy"]["blockers"])
    pub = json.loads(call(h.public_case, id=case["id"])["body"])
    assert pub["tally"]["yes"] == 2 and "votes" not in pub
    assert call(h.vote, {"flat": "<x>", "agree": True}, id=case["id"])["statusCode"] == 400
    assert call(h.vote, {"flat": "A-3", "agree": "yes"}, id=case["id"])["statusCode"] == 400
