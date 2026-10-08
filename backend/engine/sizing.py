"""Deterministic solar sizing, subsidy and payback. No LLM math anywhere."""
from __future__ import annotations
import json
from dataclasses import dataclass, asdict
from pathlib import Path

CONFIG = json.loads((Path(__file__).parent / "config" / "subsidy.json").read_text())


@dataclass
class SizingInput:
    monthly_units_kwh: float
    tariff_inr_per_kwh: float
    roof_area_m2: float
    city: str = "default"
    shading_pct: float = 10.0
    sanctioned_load_kw: float | None = None
    is_society: bool = False
    num_houses: int = 1
    loan_rate_pct: float | None = None


def _yield(city: str) -> float:
    table = CONFIG["yield_kwh_per_kwp_year"]
    return float(table.get(city, table["default"]))


def subsidy_inr(kwp: float, is_society: bool, num_houses: int) -> float:
    if is_society:
        c = CONFIG["rwa_ghs"]
        eligible = min(kwp, c["max_kw_per_house"] * max(num_houses, 1), c["max_total_kw"])
        return round(eligible * c["per_kw"])
    c = CONFIG["individual"]
    first = min(kwp, 2) * c["per_kw_first_2"]
    third = max(min(kwp, 3) - 2, 0) * c["per_kw_3rd"]
    return round(min(first + third, c["cap"]))


def size_system(inp: SizingInput) -> dict:
    if inp.monthly_units_kwh <= 0 or inp.tariff_inr_per_kwh <= 0 or inp.roof_area_m2 <= 0:
        raise ValueError("units, tariff and roof area must be positive")
    y = _yield(inp.city)
    usable = inp.roof_area_m2 * CONFIG["usable_roof_fraction"] * (1 - inp.shading_pct / 100)
    kwp_roof = usable / CONFIG["m2_per_kwp"]
    kwp_demand = inp.monthly_units_kwh * 12 / y
    kwp = min(kwp_roof, kwp_demand)
    if inp.sanctioned_load_kw:
        kwp = min(kwp, inp.sanctioned_load_kw)
    kwp = round(max(kwp, 0), 2)
    limiting = ("roof" if kwp_roof < kwp_demand else "demand")
    if inp.sanctioned_load_kw and kwp == round(inp.sanctioned_load_kw, 2) and inp.sanctioned_load_kw < min(kwp_roof, kwp_demand):
        limiting = "sanctioned_load"

    annual_gen = kwp * y
    gross = kwp * CONFIG["cost_per_kwp_inr"]
    sub = subsidy_inr(kwp, inp.is_society, inp.num_houses)
    net = gross - sub
    cum, payback, savings_y1 = -net, None, None
    series = []
    for yr in range(1, CONFIG["system_life_years"] + 1):
        gen = annual_gen * (1 - CONFIG["degradation"]) ** (yr - 1)
        save = min(gen, inp.monthly_units_kwh * 12) * inp.tariff_inr_per_kwh * (1 + CONFIG["tariff_escalation"]) ** (yr - 1)
        if yr == 1:
            savings_y1 = save
        prev = cum
        cum += save
        series.append({"year": yr, "cumulative_inr": round(cum)})
        if payback is None and cum >= 0:
            payback = round(yr - 1 + (-prev / save if save else 0), 1)
    return {
        "system_kwp": kwp,
        "limiting_factor": limiting,
        "annual_generation_kwh": round(annual_gen),
        "offset_pct": round(min(annual_gen / (inp.monthly_units_kwh * 12), 1) * 100, 1),
        "gross_cost_inr": round(gross),
        "subsidy_inr": sub,
        "net_cost_inr": round(net),
        "year1_savings_inr": round(savings_y1 or 0),
        "payback_years": payback,
        "co2_avoided_tonnes_per_year": round(annual_gen * CONFIG["grid_emission_kg_per_kwh"] / 1000, 2),
        "cumulative_series": series,
        "assumptions": {
            "yield_kwh_per_kwp_year": y,
            "usable_roof_fraction": CONFIG["usable_roof_fraction"],
            "m2_per_kwp": CONFIG["m2_per_kwp"],
            "shading_pct": inp.shading_pct,
            "cost_per_kwp_inr": CONFIG["cost_per_kwp_inr"],
            "tariff_escalation": CONFIG["tariff_escalation"],
            "degradation": CONFIG["degradation"],
            "subsidy_verified": CONFIG["retrieved"] != "UNVERIFIED",
            "subsidy_source": CONFIG["source_url"],
        },
        "input": asdict(inp),
    }
