from engine.bill import parse_bill_text, validate, extract_bill

SAMPLE = """
State Electricity Board  Consumer No 12345
Sanctioned Load: 5 kW
Units Consumed: 420
Energy Charges Rs. 3,150.00
Net Amount Payable Rs. 3,890
"""


def test_parse_sample():
    f = parse_bill_text(SAMPLE)
    assert f.monthly_units_kwh == 420
    assert f.sanctioned_load_kw == 5
    assert f.tariff_inr_per_kwh == 7.5
    assert f.total_amount_inr == 3890


def test_validate_rejects_implausible():
    f = parse_bill_text("Units Consumed: 99999999")
    clean, conf, notes = validate(f)
    assert clean["monthly_units_kwh"] is None and notes


def test_extract_never_raises_on_garbage():
    r = extract_bill(b"not an image")
    assert r["method"] == "manual"
    assert set(r["fields"]) == {"monthly_units_kwh", "tariff_inr_per_kwh", "sanctioned_load_kw"}
