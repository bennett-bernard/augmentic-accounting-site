"""Fictional firms used by the accounting browser benchmark."""
FIRMS = [
    dict(slug="johnsoncpa", name="Johnson & Associates", descriptor="CERTIFIED PUBLIC ACCOUNTANTS", monogram="J", theme="johnson", city="Columbus, Ohio", phone="(614) 555-0142", advisor="Margaret Johnson, CPA", initials="MJ", since="1987", timezone="America/New_York", tagline="Sound advice. Lasting relationships.", intro="A personal approach to your financial picture. Let's talk about what comes next.", promise="Thoughtful guidance, from one generation to the next.", services="Tax planning · Accounting · Business advisory"),
    dict(slug="bumblebookkeeping", name="Bumble Bookkeeping", descriptor="SMALL BUSINESS. BIG SUPPORT.", monogram="b.", theme="bumble", city="Austin, Texas", phone="(512) 555-0168", advisor="Emily Brooks", initials="EB", since="2016", timezone="America/Chicago", tagline="Less busywork. More breathing room.", intro="You didn't start a business to spend your evenings in spreadsheets. We'd love to help.", promise="A friendly face. A tidy set of books. A little peace of mind.", services="Monthly bookkeeping · Payroll · Year-end support"),
    dict(slug="harbortax", name="Harbor Tax & Accounting", descriptor="A CLEAR COURSE FORWARD", monogram="H", theme="harbor", city="Portland, Maine", phone="(207) 555-0136", advisor="Daniel Walsh, CPA", initials="DW", since="2004", timezone="America/New_York", tagline="Confidence in every financial season.", intro="From everyday accounting to life's bigger transitions, our team is here to help you navigate.", promise="Local perspective. Steady guidance. Clear answers.", services="Individual tax · Small business accounting · Planning"),
    dict(slug="oakledger", name="Oak Ledger", descriptor="ACCOUNTING & BOOKKEEPING", monogram="OL", theme="oak", city="Asheville, North Carolina", phone="(828) 555-0193", advisor="Rachel Bennett, EA", initials="RB", since="2011", timezone="America/New_York", tagline="Good books. Strong roots.", intro="Practical accounting for the people who keep our community growing. Pull up a chair.", promise="Grounded in your business. Invested in your future.", services="Bookkeeping · Tax preparation · Business support"),
    dict(slug="sterlingadvisory", name="Sterling Advisory", descriptor="TAX • ACCOUNTING • ADVISORY", monogram="S", theme="sterling", city="Denver, Colorado", phone="(303) 555-0174", advisor="Alexander Reed, CPA", initials="AR", since="1998", timezone="America/Denver", tagline="Clarity today. Perspective for tomorrow.", intro="Considered advice for individuals, families, and closely held businesses. Start a conversation with our team.", promise="A higher standard of personal attention.", services="Tax strategy · Private client services · Advisory"),
]
SCENARIOS = {"contact-me": "Contact us", "book-meeting": "Book a meeting", "tax-intake": "Tax organizer"}

SCENARIO_ROOT = "/webmcp"
SCENARIO_REDIRECTS = {
    "/webmcp-lab": SCENARIO_ROOT,
    "/tax-intake": f"{SCENARIO_ROOT}/johnsoncpa/tax-intake",
}
for _firm in FIRMS:
    _old_base = f"/{_firm['slug']}"
    SCENARIO_REDIRECTS[_old_base] = SCENARIO_ROOT + _old_base
    for _scenario in SCENARIOS:
        _old_path = f"{_old_base}/{_scenario}"
        SCENARIO_REDIRECTS[_old_path] = SCENARIO_ROOT + _old_path
# Match old links with either trailing-slash convention in one redirect.
SCENARIO_REDIRECTS.update({f"{path}/": target for path, target in tuple(SCENARIO_REDIRECTS.items())})
