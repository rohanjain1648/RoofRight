// RoofRight eligibility & approval policies (Cedar).
// Each Check* action is one gate in the society's path to a solar application.

@id("roof-right-clear")
permit (principal, action == Action::"CheckRoofRight", resource)
when { resource.roof_right == "society_common" || resource.roof_right == "owner_exclusive" };

@id("roof-right-disputed-forbid")
forbid (principal, action == Action::"CheckRoofRight", resource)
when { resource.roof_right == "disputed" };

@id("consent-majority")
permit (principal, action == Action::"CheckConsent", resource)
when { resource.consent_pct >= 51 };

@id("structural-ok")
permit (principal, action == Action::"CheckStructural", resource)
when { resource.structural_ok == true };

@id("load-covers-system")
permit (principal, action == Action::"CheckLoad", resource)
when { resource.sanctioned_load_dkw >= resource.system_dkw };

@id("secretary-approves-resolution")
permit (principal, action == Action::"ApproveResolution", resource)
when { principal.role == "secretary" && resource.consent_pct >= 51 };

@id("only-secretary-or-owner-submits")
permit (principal, action == Action::"SubmitApplication", resource)
when { (principal.role == "secretary" || principal.role == "owner")
       && resource.consent_pct >= 51 && resource.roof_right != "disputed" };
