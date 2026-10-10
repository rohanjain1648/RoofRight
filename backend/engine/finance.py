"""Deterministic money and lifecycle maths for a society: per-flat split, loan comparison, end-of-life waste.

Like sizing.py, nothing here is produced by a language model.
"""
from __future__ import annotations
from .sizing import CONFIG

FIN = CONFIG["finance"]
LIFE = CONFIG["lifecycle"]


def emi(principal: float, annual_rate_pct: float, months: int) -> float:
    """Standard reducing-balance EMI. Zero rate degrades to straight division."""
    if principal <= 0:
        return 0.0
    if months <= 0:
        raise ValueError("months must be positive")
    r = annual_rate_pct / 1200
    if r == 0:
        return principal / months
    f = (1 + r) ** months
    return principal * r * f / (f - 1)


def finance_options(result: dict, num_houses: int) -> dict:
    """Per-flat economics and how each funding route compares with monthly savings."""
    flats = max(int(num_houses or 1), 1)
    net = float(result["net_cost_inr"])
    monthly_saving = float(result["year1_savings_inr"]) / 12
    options = []
    for opt in FIN["options"]:
        months = int(opt["months"])
        pay = emi(net, float(opt["rate_pct"]), months) if months else 0.0
        upfront = net if not months else 0.0
        total_paid = pay * months if months else net
        options.append({
            "id": opt["id"],
            "label": opt["label"],
            "rate_pct": opt["rate_pct"],
            "months": months,
            "upfront_inr": round(upfront),
            "emi_inr": round(pay),
            "emi_per_flat_inr": round(pay / flats),
            "monthly_net_inr": round(monthly_saving - pay),
            "cash_positive_from_month_one": months > 0 and monthly_saving >= pay,
            "interest_inr": round(max(total_paid - net, 0)),
        })
    return {
        "flats": flats,
        "net_cost_per_flat_inr": round(net / flats),
        "monthly_saving_inr": round(monthly_saving),
        "monthly_saving_per_flat_inr": round(monthly_saving / flats),
        "options": options,
        "assumptions": {
            "loan_on": "net cost after subsidy (assumes the subsidy, once credited, goes to the loan)",
            "rates_verified": FIN["rates_verified"],
            "rates_source": FIN["source"],
        },
    }


def lifecycle(result: dict) -> dict:
    """End-of-life view: how much hardware becomes waste, and what to ask vendors for now."""
    panels = round(result["system_kwp"] * 1000 / LIFE["panel_watt"])
    panel_kg = panels * LIFE["panel_kg"]
    life_years = CONFIG["system_life_years"]
    return {
        "panels": panels,
        "panel_mass_kg": round(panel_kg),
        "inverter_replacements": max(life_years // LIFE["inverter_life_years"] - 1, 0) + 1,
        "recoverable_mass_kg": round(panel_kg * LIFE["recoverable_fraction"]),
        "life_years": life_years,
        "co2_avoided_lifetime_tonnes": round(result["co2_avoided_tonnes_per_year"] * life_years * (1 - CONFIG["degradation"] * life_years / 2), 1),
        "vendor_asks": LIFE["vendor_asks"],
        "regulation_note": LIFE["regulation_note"],
    }
