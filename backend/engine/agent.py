"""RoofRight chat agent (Strands Agents SDK).

The agent's tools wrap the deterministic engine, so every number it states comes from code, not the model.
If the local model is unavailable, a rule-based answerer explains the case from the same data.
"""
from __future__ import annotations
import json, os
from strands import Agent, tool

from .sizing import SizingInput, size_system, subsidy_inr
from .policy import evaluate

TEXT_MODEL = os.environ.get("ROOFRIGHT_TEXT_MODEL", "qwen2.5:3b")
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")

SYSTEM_PROMPT = (
    "You are RoofRight, an assistant helping an Indian housing society go solar under PM Surya Ghar. "
    "Always call tools for facts: never guess numbers. Be brief, plain-language, and say what to do next. "
    "If subsidy_verified is false, remind the user to confirm subsidy amounts on pmsuryaghar.gov.in."
)


def build_tools(case: dict):
    """Tools closed over one case, so the model can only read/compute for that society."""
    result = case["result"]

    @tool
    def get_case_summary() -> str:
        """Return the society's sizing result: system size, cost, subsidy, payback, CO2 and assumptions."""
        keep = {k: v for k, v in result.items() if k not in ("input",)}
        return json.dumps({"society": case.get("society_name"), "city": case.get("city"), **keep})

    @tool
    def check_blockers() -> str:
        """Run the Cedar policy gates and return what is blocking the application, with how to fix each blocker."""
        gate_case = {**case, "system_kwp": result["system_kwp"]}
        return json.dumps(evaluate(gate_case))

    @tool
    def what_if_size(kwp: float) -> str:
        """Compute subsidy for a hypothetical system size in kWp (deterministic, uses the subsidy config)."""
        return json.dumps({"kwp": kwp, "subsidy_inr": subsidy_inr(kwp, bool(case.get("is_society", True)), int(case.get("num_houses", 1)))})

    @tool
    def what_if_consent(consent_pct: int) -> str:
        """Re-run the policy gates as if consent_pct percent of members had consented."""
        gate_case = {**case, "consent_pct": consent_pct, "system_kwp": result["system_kwp"]}
        return json.dumps(evaluate(gate_case))

    return [get_case_summary, check_blockers, what_if_size, what_if_consent]


def rule_based_answer(case: dict, message: str) -> str:
    """No-LLM fallback: explain the case from Cedar + engine output."""
    r = case["result"]
    policy = case.get("policy") or evaluate({**case, "system_kwp": r["system_kwp"]})
    m = message.lower()
    lines = []
    if any(w in m for w in ("block", "stuck", "why", "problem", "रुक", "बाधा")) or not m.strip():
        if policy["blockers"]:
            lines.append("Here is what is blocking your application:")
            lines += [f"- {b['label']}: {b['fix']}" for b in policy["blockers"]]
        else:
            lines.append("Nothing is blocking you. All gates pass; you can approve the resolution and submit.")
    elif any(w in m for w in ("subsid", "सब्सिडी")):
        lines.append(f"Estimated subsidy is Rs. {r['subsidy_inr']:,} on a Rs. {r['gross_cost_inr']:,} system (net Rs. {r['net_cost_inr']:,}).")
        if not r["assumptions"]["subsidy_verified"]:
            lines.append("These subsidy rules are not yet verified; confirm on pmsuryaghar.gov.in.")
    elif any(w in m for w in ("payback", "save", "saving", "बचत")):
        lines.append(f"Year-1 savings about Rs. {r['year1_savings_inr']:,}; payback about {r['payback_years']} years.")
    else:
        lines.append(f"A {r['system_kwp']} kWp system would generate about {r['annual_generation_kwh']:,} kWh/year "
                     f"({r['offset_pct']}% of your usage) and avoid {r['co2_avoided_tonnes_per_year']} t CO2 a year.")
        if policy["blockers"]:
            lines.append(f"{len(policy['blockers'])} blocker(s) remain; ask me what's blocking you.")
    return "\n".join(lines)


def answer(case: dict, message: str) -> dict:
    """Answer via the Strands agent; fall back to rule-based on any model failure."""
    if os.environ.get("ROOFRIGHT_AGENT", "auto") != "rules":
        try:
            from strands.models.ollama import OllamaModel
            agent = Agent(model=OllamaModel(host=OLLAMA_HOST, model_id=TEXT_MODEL, temperature=0.2),
                          tools=build_tools(case), system_prompt=SYSTEM_PROMPT, callback_handler=None)
            res = agent(message or "What is blocking us?")
            calls = sorted({name for name in getattr(res.metrics, "tool_metrics", {})})
            return {"answer": str(res).strip(), "engine": "strands+ollama", "tool_calls": calls}
        except Exception as e:
            fallback_reason = type(e).__name__
    else:
        fallback_reason = "forced"
    return {"answer": rule_based_answer(case, message), "engine": "rules", "tool_calls": [], "fallback_reason": fallback_reason}
