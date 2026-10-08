from engine.sizing import SizingInput, size_system
from engine.documents import consent_resolution, vendor_rfq

CASE = dict(society_name="Green Apts", city="Delhi", consent_pct=70, roof_area_m2=300, sanctioned_load_kw=20)


def test_pdfs_are_valid():
    r = size_system(SizingInput(2000, 8, 300, "Delhi", is_society=True, num_houses=40))
    for pdf in (consent_resolution(CASE, r), vendor_rfq(CASE, r)):
        assert pdf.startswith(b"%PDF") and len(pdf) > 1500
