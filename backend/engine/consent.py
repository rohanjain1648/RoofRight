"""Consent drive: residents vote by flat, the society's consent % is recomputed, Cedar gates re-run.

One vote per flat (a later vote from the same flat replaces the earlier one).
"""
from __future__ import annotations
import re
from datetime import datetime, timezone

from .policy import evaluate

FLAT_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9 /-]{0,11}$")


def normalise_flat(flat: str) -> str:
    flat = (flat or "").strip().upper()
    if not FLAT_RE.match(flat):
        raise ValueError("flat must be 1-12 characters: letters, digits, space, / or -")
    return re.sub(r"\s+", " ", flat)


def tally(case: dict) -> dict:
    votes = case.get("votes") or {}
    houses = max(int(case.get("num_houses") or 1), 1)
    yes = sum(1 for v in votes.values() if v.get("agree"))
    return {"yes": yes, "no": len(votes) - yes, "voted": len(votes), "houses": houses,
            "pct": min(round(100 * yes / houses), 100), "needed_for_majority": max(houses // 2 + 1 - yes, 0)}


def record_vote(case: dict, flat: str, agree: bool, role: str = "secretary") -> dict:
    """Mutates and returns the case: adds the vote, recomputes consent, re-evaluates Cedar gates."""
    if len(case.get("votes") or {}) >= max(int(case.get("num_houses") or 1), 1) and normalise_flat(flat) not in (case.get("votes") or {}):
        raise ValueError("every flat has already voted")
    key = normalise_flat(flat)
    case.setdefault("votes", {})[key] = {"agree": bool(agree), "at": datetime.now(timezone.utc).isoformat(timespec="seconds")}
    t = tally(case)
    case["consent_pct"] = t["pct"]
    case["consent_source"] = "votes"
    case["consent_tally"] = t
    case["policy"] = evaluate({**case, "system_kwp": case["result"]["system_kwp"]}, role=role)
    return case
