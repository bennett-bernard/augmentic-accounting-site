# Accounting interaction samples

Five fictional firm identities each expose three client workflows. The directory is
`/webmcp`; each `/webmcp/<firm>` URL opens its contact sample. Previous firm
URLs, `/webmcp-lab`, and `/tax-intake` permanently redirect into this namespace,
preserving query parameters such as `webmcp=off` and the pinned calendar `date`.

| Firm prefix | Contact | Booking | Organizer |
| --- | --- | --- | --- |
| `/webmcp/johnsoncpa` | `/contact-me` | `/book-meeting` | `/tax-intake` |
| `/webmcp/bumblebookkeeping` | `/contact-me` | `/book-meeting` | `/tax-intake` |
| `/webmcp/harbortax` | `/contact-me` | `/book-meeting` | `/tax-intake` |
| `/webmcp/oakledger` | `/contact-me` | `/book-meeting` | `/tax-intake` |
| `/webmcp/sterlingadvisory` | `/contact-me` | `/book-meeting` | `/tax-intake` |

All pages are fictional, clearly labeled, and `noindex`. They do not load analytics,
transmit form values, read document bytes, send mail, write calendar events, persist
PII, calculate tax, or file a return. Selected files contribute only their names and
sizes to page-local state. Reloading resets the run. The organizer is inspired by
common TaxDome-style client workflows; it is not a TaxDome integration or replica.

## Comparing browser interaction with native tools

Use the same URL and input fixture for paired runs:

- Native: `/webmcp/johnsoncpa/book-meeting?date=2026-09-14`
- Browser-only: `/webmcp/johnsoncpa/book-meeting?date=2026-09-14&webmcp=off`

The `date` parameter pins the calendar anchor. Without it, availability starts
on the next UTC date. Slots span 60 days, exclude weekends in the firm's time zone,
and vary deterministically with firm and date. Slot IDs are exact UTC instants;
labels reflect the selected IANA time zone, including daylight saving changes.
A pinned historical date remains usable intentionally, for repeatable experiments.

Browser-only mode does not register these scenario tools. It does not disable
unrelated tools injected by extensions or Cloudflare. Inspect the complete tool list
in the actual test environment and keep unrelated tools out of the agent's allowlist.
Both modes call the same application validators and submission functions. Native
mode uses `document.modelContext` with a fallback to `navigator.modelContext`; it
never installs a polyfill. The experiment footer distinguishes unavailable, failed,
and successful native registration.

[Chrome setup](https://developer.chrome.com/docs/ai/webmcp) and the
[imperative API](https://developer.chrome.com/docs/ai/webmcp/imperative-api)
describe browser flags/origin trials. The local suite runs real Chromium WebMCP
with `--enable-blink-features=WebMCP,WebMCPTesting` and
`--enable-experimental-web-platform-features`, rather than mocking registration.

| Scenario | Tool | Purpose |
| --- | --- | --- |
| Every page | `get_scenario_state` | Inspect progress, current field schema and completion |
| Contact | `submit_contact_inquiry` | Fill, validate and simulate sending a contact form |
| Booking | `get_available_appointments` | Discover slots for a type/date range/time zone |
| Booking | `book_appointment` | Select an available slot and confirm attendee details |
| Intake | `update_tax_step` | Update the current step, optionally validate and advance |
| Intake | `add_tax_dependent` | Add a dependent on the Household step |
| Intake | `go_to_tax_step` | Revisit a reached step; forward moves validate intervening steps |
| Intake | `submit_tax_intake` | Validate signature/consent and submit at Review |

Intake progresses through personal details, household, income, deductions,
documents, and review. Spouse fields appear for married statuses; business fields
appear for self-employment; donation amounts appear for charity. The document
checklist follows the income and deduction selections. Choose `documentPlan: "later"`
for agent runs without files. The file picker works through normal browser
interaction; no tool fabricates an uploaded document or accepts local filesystem paths.

For dependent fields, add the dependent first, then inspect `get_scenario_state`.
For conditional branches, `update_tax_step` accepts the selector and its newly
revealed fields in one call. Other unknown fields fail. A successful submission
returns a stable receipt within that page; retries do not create additional receipts.

## Suggested shared fixture

Contact: name `Alex Morgan`, email `alex@example.test`, phone `555-0100`, and
message “I need help organizing my small business books.” The form and
`submit_contact_inquiry` accept only `name`, `email`, `phone`, and `message`; phone
is optional. Name is one full-name field.

Booking: introductory call, first available slot on the pinned date, America/Chicago,
Alex Morgan, `alex@example.test`, video call, confirmation true.

Intake: 2025, Alex Morgan, `alex@example.test`, born 1988-04-12, test ID ending 1234,
123 Example Street, Austin TX 78701; married jointly to Taylor Morgan, born
1989-05-10, ID ending 5678; dependent Sam Morgan, born 2015-01-01, child, 12 months;
self-employment at Example Studio (Design), income 20000, expenses 3000; donations
500; documents later; signature Alex Morgan and review confirmation true.

## Measurement

Every sample has Reset and Download run record controls. A read-only
`window.__accountingBenchmark` snapshot also lets a harness observe completion.
Records include firm, scenario, mode, native registration state, calendar anchor,
start/finish time, elapsed milliseconds and named UI/tool events. They exclude
entered values, filenames, contact information and taxpayer details.

Elapsed time begins when the page script runs and includes idle time and tool discovery.
Events represent application events, not a normalized count of agent actions.
Measure actual agent interactions, model tokens, latency and cost in the external
harness. Randomize run order, fix the browser/model/input fixture, and report task
success and errors alongside timing. Merely completing these tests establishes
functionality; it does not establish an efficiency advantage.

## Source and validation

- `scenario_firms.py`: firm identities and scenario labels.
- `main.py`: concrete routes discovered by the static builder.
- `templates/scenario.html`, `templates/scenario-lab.html`: independent sample shell/directory.
- `static/css/scenarios.css`: five responsive visual identities.
- `static/js/scenarios.mjs`: application actions, validation, calendars, organizer and tools.
- `tests/test_scenarios.py`, `tests/integration/scenarios.spec.mjs`: routes, browser workflows,
  real native tool completion, validation, baseline isolation, reset, responsive layout,
  no-network submissions, and timezone/DST checks.

Run `npm test`, then `npm run build`. On this environment, Chromium requires
`LD_LIBRARY_PATH=/tmp/augmentic-browser-libs/usr/lib/x86_64-linux-gnu`.

The checkout also contains unfinished readiness-assessment changes, including a
placeholder production D1 binding. Do not deploy the entire working checkout while
that configuration is pending. The initial scenario release is staged from committed
production source plus only the scenario files and additive route/resources changes.
Existing assessment edits remain in the working tree.

## Initial release validation — 2026-09-10

The full checkout passed 12 Python tests, TypeScript checking, 21 Worker tests,
and 40 Playwright tests. The new suite completes all 15 samples through ordinary
controls and all 15 through real native WebMCP. It also checks invalid inputs,
conditional fields, repeat submission, resets, browser-only tool isolation,
calendar determinism and daylight-saving conversion. All sample layouts fit
1440, 390 and 320 px widths. An organizer navigation overflow found during testing
was fixed. Use `npx playwright test --workers=1` on this constrained host; two
concurrent browser workers caused local Wrangler proxy crashes.

The production-only staging tree is `/tmp/augmentic-scenarios-release-qto5y6mi`.
It starts at committed source `09850d9`, adds only the sample implementation,
route/resources links and documentation, and retains the original Worker and
configuration with its sole ASSETS binding. Its 33 browser checks passed (32 in
the full run plus the corrected responsive check), and its deployment dry-run passed.
The previous production Worker version is `4cad3451-55d4-4657-a5cc-e59bf8849140`.
Do not use the staging directory as a replacement for the working checkout.

Published successfully to `https://augmenticaccounting.com/webmcp-lab` on
2026-09-10, Worker version `e1178937-b0ba-42b9-b8a5-51d71a80708c`. All 15 live
scenario URLs returned 200 and the live JavaScript/CSS matched the tested files
byte-for-byte. Native tool discovery and state calls worked on all three live
scenario types; browser-only mode exposed none of the scenario tools. Cloudflare
also injects C2PA tools and `search_articles`; keep those outside the experiment's
agent tool allowlist. The temporary deployment credential file was removed.

## Contact form simplification — 2026-09-10

Published Worker version `b1c5cbb1-a73f-415e-b79e-b30e4584f944`. Every contact
page now has exactly four fields: `name`, `email`, `phone`, and `message`. Name is
a single full-name field; phone is optional. Service, contact method, business,
and contact consent controls have been removed. The generated native WebMCP
schema and contact fixtures match the new form. Existing console examples using
`firstName`/`lastName` should use `name` and omit the removed fields.

All 24 scenario checks passed before deployment, and the isolated deployment
dry-run passed. After publication, the live script matched the tested file;
all five live forms exposed exactly the four expected fields and completed native
WebMCP submissions without a phone number. The temporary API token file was deleted.

## Sample URL namespace — 2026-09-10

Published Worker version `78ab9724-ff42-4dd7-8c6d-206de0fefe51`. The sample
directory is now `https://augmenticaccounting.com/webmcp`, with all five firms
and their three scenarios under `/webmcp/<firm>/<scenario>`. Navigation,
resource links, fixtures, and sitemap entries use the new namespace. The 22
old paths and their trailing-slash variants return permanent 301 redirects;
`webmcp` and pinned calendar `date` query parameters survive the redirects.

Validation passed: 9 Python route/build tests, the static build, deployment
dry-run, and all 34 production browser checks. The first browser run passed
26 checks before local Wrangler proxy connection failures interrupted the
remaining checks; those 8 passed on a fresh server with a 90-second timeout.
After deployment, all 15 live scenario pages, all 44 legacy redirects,
directory links, sitemap, and matching JavaScript/CSS assets were verified.
Real native WebMCP state calls worked on each scenario type at its new URL;
browser-only mode also worked after a legacy URL redirect.

The release used the isolated production staging tree, preserving the existing
Worker and configuration. The previous production version is
`b1c5cbb1-a73f-415e-b79e-b30e4584f944`. The temporary Cloudflare credential
file and deployment wrapper were deleted after successful live verification.
