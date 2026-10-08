"""Electricity-bill extraction with a fallback chain:

    Strands + Ollama vision (structured output)  ->  Tesseract OCR + regex  ->  manual entry

The result is always shown to the user for confirmation; nothing here is trusted blindly.
"""
from __future__ import annotations
import io, os, re
from pydantic import BaseModel, Field

VISION_MODEL = os.environ.get("ROOFRIGHT_VISION_MODEL", "qwen2.5vl:3b")
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://localhost:11434")

# Plausible ranges: values outside are treated as extraction errors.
RANGES = {"monthly_units_kwh": (1, 50000), "tariff_inr_per_kwh": (1, 25), "sanctioned_load_kw": (0.5, 500)}


class BillFields(BaseModel):
    monthly_units_kwh: float | None = Field(None, description="Units (kWh) consumed in the billing period")
    tariff_inr_per_kwh: float | None = Field(None, description="Average energy charge in INR per kWh")
    sanctioned_load_kw: float | None = Field(None, description="Sanctioned / contract load in kW")
    total_amount_inr: float | None = Field(None, description="Total bill amount payable in INR")


def _num(s: str) -> float | None:
    try:
        return float(s.replace(",", "").strip())
    except ValueError:
        return None


def parse_bill_text(text: str) -> BillFields:
    """Regex parser for OCR text. Deliberately conservative: returns None for anything ambiguous."""
    t = re.sub(r"[ \t]+", " ", text)
    def find(*patterns):
        for p in patterns:
            m = re.search(p, t, re.I)
            if m and _num(m.group(1)) is not None:
                return _num(m.group(1))
        return None
    units = find(r"(?:units?|energy)\s*consumed[^\d\n]{0,20}([\d,]+(?:\.\d+)?)",
                 r"consumption[^\d\n]{0,20}([\d,]+(?:\.\d+)?)\s*(?:kwh|units)",
                 r"([\d,]+(?:\.\d+)?)\s*(?:kwh|units)\b")
    load = find(r"(?:sanctioned|contract(?:ed)?|connected)\s*load[^\d\n]{0,20}([\d.]+)\s*(?:kw)?")
    total = find(r"(?:net|total)\s*(?:amount\s*)?(?:payable|amount|bill)[^\d\n]{0,20}(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?)")
    tariff = find(r"(?:tariff|rate)[^\d\n]{0,20}(?:rs\.?|inr|₹)?\s*([\d.]+)\s*(?:/|per)\s*(?:kwh|unit)")
    energy_charge = find(r"energy\s*charges?[^\d\n]{0,20}(?:rs\.?|inr|₹)?\s*([\d,]+(?:\.\d+)?)")
    if tariff is None and energy_charge and units:
        tariff = round(energy_charge / units, 2)
    elif tariff is None and total and units:
        tariff = round(total / units, 2)  # effective all-in rate; flagged as low confidence by caller
    return BillFields(monthly_units_kwh=units, tariff_inr_per_kwh=tariff, sanctioned_load_kw=load, total_amount_inr=total)


def validate(fields: BillFields) -> tuple[dict, dict, list[str]]:
    """Range-check fields. Returns (clean_fields, confidence, notes)."""
    clean, conf, notes = {}, {}, []
    for key, (lo, hi) in RANGES.items():
        v = getattr(fields, key)
        if v is None:
            clean[key], conf[key] = None, 0.0
            notes.append(f"{key} not found: please enter it manually")
        elif not (lo <= v <= hi):
            clean[key], conf[key] = None, 0.0
            notes.append(f"{key}={v} looks implausible (expected {lo}-{hi}); please check")
        else:
            clean[key], conf[key] = v, 0.85
    return clean, conf, notes


def _ocr_text(image_bytes: bytes) -> str:
    import pytesseract
    from PIL import Image
    return pytesseract.image_to_string(Image.open(io.BytesIO(image_bytes)))


def _vision_extract(image_bytes: bytes) -> BillFields:
    from strands import Agent
    from strands.models.ollama import OllamaModel
    model = OllamaModel(host=OLLAMA_HOST, model_id=VISION_MODEL, temperature=0.0)
    agent = Agent(model=model, system_prompt=(
        "You read Indian electricity bills. Extract only what is printed. If a value is not visible, leave it null. "
        "monthly_units_kwh is units consumed in the billing period. tariff_inr_per_kwh is energy charge divided by units "
        "if no explicit rate is shown."), callback_handler=None)
    fmt = "png" if image_bytes[:8] == b"\x89PNG\r\n\x1a\n" else "jpeg"
    msg = [{"text": "Extract the bill fields."}, {"image": {"format": fmt, "source": {"bytes": image_bytes}}}]
    return agent(msg, structured_output_model=BillFields).structured_output


def extract_bill(image_bytes: bytes) -> dict:
    """Try vision, then OCR, then return an empty manual-entry form. Never raises."""
    attempts: list[str] = []
    for method, fn in (("vision", lambda: _vision_extract(image_bytes)),
                       ("ocr", lambda: parse_bill_text(_ocr_text(image_bytes)))):
        try:
            fields = fn()
            clean, conf, notes = validate(fields)
            if any(v is not None for v in clean.values()):
                if method == "ocr":
                    conf = {k: round(c * 0.8, 2) for k, c in conf.items()}
                return {"fields": clean, "confidence": conf, "method": method, "notes": notes, "attempts": attempts}
            attempts.append(f"{method}: nothing usable found")
        except Exception as e:  # model down, tesseract missing, bad image, etc.
            attempts.append(f"{method}: {type(e).__name__}")
    blank = {k: None for k in RANGES}
    return {"fields": blank, "confidence": {k: 0.0 for k in RANGES}, "method": "manual",
            "notes": ["Could not read the bill automatically. Please enter the values from your bill."], "attempts": attempts}
