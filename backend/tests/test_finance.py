import pytest
from engine.sizing import SizingInput, size_system
from engine.finance import emi, finance_options, lifecycle
from engine.consent import record_vote, tally, normalise_flat


def _result():
    return size_system(SizingInput(3000, 8, 400, "Delhi", is_society=True, num_houses=40, sanctioned_load_kw=30))


def test_emi_known_value():
    # 1,00,000 at 12% for 12 months = 8884.88 (standard EMI table)
    assert emi(100000, 12, 12) == pytest.approx(8884.88, abs=0.01)
    assert emi(1200, 0, 12) == 100
    assert emi(0, 10, 12) == 0


def test_finance_per_flat_and_options():
    r = _result()
    f = finance_options(r, 40)
    assert f["net_cost_per_flat_inr"] == round(r["net_cost_inr"] / 40)
    ids = [o["id"] for o in f["options"]]
    assert ids == ["self", "psu", "nbfc"]
    psu, nbfc = f["options"][1], f["options"][2]
    assert nbfc["emi_inr"] > psu["emi_inr"] > 0
    assert nbfc["interest_inr"] > psu["interest_inr"]
    assert f["options"][0]["upfront_inr"] == r["net_cost_inr"]


def test_lifecycle():
    r = _result()
    lc = lifecycle(r)
    assert lc["panels"] == round(r["system_kwp"] * 1000 / 550)
    assert lc["recoverable_mass_kg"] < lc["panel_mass_kg"]
    assert lc["vendor_asks"]


def _case():
    r = _result()
    return {"num_houses": 4, "roof_right": "society_common", "structural_ok": True, "sanctioned_load_kw": 30,
            "consent_pct": 0, "result": {k: v for k, v in r.items() if k != "cumulative_series"}}


def test_votes_flip_consent_gate():
    c = _case()
    record_vote(c, "a-101", True)
    record_vote(c, "A-102", True)
    assert tally(c)["pct"] == 50
    assert any(b["gate"] == "CheckConsent" for b in c["policy"]["blockers"])
    record_vote(c, "A-103", True)
    assert c["consent_pct"] == 75
    assert not any(b["gate"] == "CheckConsent" for b in c["policy"]["blockers"])


def test_revote_replaces_and_normalises():
    c = _case()
    record_vote(c, " a-101 ", True)
    record_vote(c, "A-101", False)
    t = tally(c)
    assert t["voted"] == 1 and t["yes"] == 0


def test_bad_flat_and_overflow():
    with pytest.raises(ValueError):
        normalise_flat("<script>")
    c = _case()
    for f in ("1", "2", "3", "4"):
        record_vote(c, f, True)
    with pytest.raises(ValueError):
        record_vote(c, "5", True)
