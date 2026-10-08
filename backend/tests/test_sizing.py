import pytest
from engine.sizing import SizingInput, size_system, subsidy_inr


def test_subsidy_individual_caps():
    assert subsidy_inr(1, False, 1) == 30000
    assert subsidy_inr(2, False, 1) == 60000
    assert subsidy_inr(3, False, 1) == 78000
    assert subsidy_inr(10, False, 1) == 78000


def test_subsidy_society_capped_by_houses():
    assert subsidy_inr(100, True, 10) == 30 * 18000


def test_demand_limited():
    r = size_system(SizingInput(300, 8, 500, "Delhi"))
    assert r["limiting_factor"] == "demand"
    assert r["system_kwp"] == pytest.approx(300 * 12 / 1400, abs=0.01)
    assert r["payback_years"] and r["payback_years"] < 10


def test_roof_limited():
    r = size_system(SizingInput(5000, 8, 50, "Delhi", shading_pct=0))
    assert r["limiting_factor"] == "roof"
    assert r["system_kwp"] == 3.0


def test_sanctioned_load_caps():
    r = size_system(SizingInput(1000, 8, 500, "Delhi", sanctioned_load_kw=2))
    assert r["system_kwp"] == 2.0 and r["limiting_factor"] == "sanctioned_load"


def test_rejects_bad_input():
    with pytest.raises(ValueError):
        size_system(SizingInput(0, 8, 100))
