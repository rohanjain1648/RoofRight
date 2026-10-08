"""Cedar-backed gate evaluation. Every gate is a Cedar authorization request."""
from __future__ import annotations
import math
from pathlib import Path
import cedarpy

POLICIES = (Path(__file__).parent.parent / "policy" / "roofright.cedar").read_text()

GATES = {
    "CheckRoofRight": ("Roof rights", "Roof ownership is disputed or unclear. Get the society to formally allot the roof as common property (or obtain the owner's NOC) before applying."),
    "CheckConsent": ("RWA consent", "Fewer than 51% of members have consented. Circulate the resolution and collect signatures."),
    "CheckStructural": ("Structural safety", "No structural certificate yet. Ask a licensed structural engineer to certify the roof can bear the load."),
    "CheckLoad": ("Sanctioned load", "Sanctioned load is lower than the system size. Apply to the DISCOM for a load enhancement."),
}
ACTIONS = {
    "ApproveResolution": ("Approve resolution", "Only the secretary can approve, and only with 51%+ consent."),
    "SubmitApplication": ("Submit application", "Only the secretary/owner can submit, with 51%+ consent and no roof dispute."),
}


def _request(principal_role: str, action: str, case: dict) -> bool:
    entities = [
        {"uid": {"type": "User", "id": "u1"}, "attrs": {"role": principal_role}, "parents": []},
        {"uid": {"type": "Case", "id": "c1"}, "attrs": {
            "roof_right": case.get("roof_right", "unknown"),
            "consent_pct": int(case.get("consent_pct", 0)),
            "structural_ok": bool(case.get("structural_ok", False)),
            # Cedar has no float type: use integer deci-kW, conservative rounding (load down, system up).
            "sanctioned_load_dkw": math.floor(float(case.get("sanctioned_load_kw") or 0) * 10 + 1e-9),
            "system_dkw": math.ceil(float(case.get("system_kwp") or 0) * 10 - 1e-9),
        }, "parents": []},
    ]
    req = {"principal": 'User::"u1"', "action": f'Action::"{action}"', "resource": 'Case::"c1"', "context": {}}
    return cedarpy.is_authorized(req, POLICIES, entities).allowed


def evaluate(case: dict, role: str = "secretary") -> dict:
    gates = []
    for action, (label, fix) in GATES.items():
        ok = _request(role, action, case)
        gates.append({"gate": action, "label": label, "passed": ok, "fix": None if ok else fix})
    perms = []
    for action, (label, why) in ACTIONS.items():
        ok = _request(role, action, case)
        perms.append({"action": action, "label": label, "allowed": ok, "why_not": None if ok else why})
    return {"gates": gates, "permissions": perms,
            "blockers": [g for g in gates if not g["passed"]],
            "ready_to_apply": all(g["passed"] for g in gates)}
