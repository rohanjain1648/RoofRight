from engine.policy import evaluate

CLEAR = dict(roof_right="society_common", consent_pct=70, structural_ok=True, sanctioned_load_kw=10, system_kwp=8)


def test_all_clear():
    r = evaluate(CLEAR)
    assert r["ready_to_apply"] and not r["blockers"]


def test_disputed_roof_blocks_everything_relevant():
    r = evaluate({**CLEAR, "roof_right": "disputed"})
    assert not r["ready_to_apply"]
    assert any(b["gate"] == "CheckRoofRight" for b in r["blockers"])
    assert not next(p for p in r["permissions"] if p["action"] == "SubmitApplication")["allowed"]


def test_resident_cannot_approve():
    r = evaluate(CLEAR, role="resident")
    assert not next(p for p in r["permissions"] if p["action"] == "ApproveResolution")["allowed"]


def test_low_consent_and_load():
    r = evaluate({**CLEAR, "consent_pct": 30, "sanctioned_load_kw": 2})
    gates = {b["gate"] for b in r["blockers"]}
    assert {"CheckConsent", "CheckLoad"} <= gates
