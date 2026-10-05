# Verification record

Checked on 28 September 2026. These results describe this session, not a guarantee of future provider access.

## Evidence from the current public website

- `https://geogoldrealty.com` served a static HTML build that differs from the older local React project.
- The page referenced `/app.js`; that URL returned HTTP 404.
- `/api/idx/listings` returned HTTP 404.
- Its contact link used `hello@geogoldrealty.com`. John's request specified `geogoldrealty@gmail.com`.
- Friday's group messages requested valuation, inquiry, property search, and CRM help.

## Live provider tests from the repaired local server

| Test | Result |
| --- | --- |
| Saved GSMLS RETS login and one-listing query | Passed |
| Bergen sale search | HTTP 200, two results with photos |
| Newark city search | HTTP 200, two Newark results with photos |
| Essex rental search | HTTP 200, two rental results with photos |
| ZIP 00000 | HTTP 200, zero results |
| Browser Newark search | Six live result cards shown |
| ZIP 07106 with price at most $600,000 and at least 3 bedrooms | Live results satisfied all three filters |
| Mobile layout at 390 pixels | Menu opened, navigation worked, and six live search results displayed |
| Ask about this home | Correct MLS number and address copied into the inquiry message |

The live metadata confirmed searchable city, ZIP, county, price, and bedrooms. It marked the street-name field non-searchable. The repaired form therefore asks for city or ZIP.

## CRM checks

The existing live CRM accepted a marked synthetic property inquiry. Returned reference: `LEAD-20260928040728-ET6AY`.

Readback found the reference in Leads A4, Follow-Up Tasks B4, and Activity Log C4. The submitted message says it is a synthetic handoff test and not to contact it. This test record remains for review. Its task should be marked done during handoff.

Before testing, Config B2 was blank and B3 was `no`. No email-alert recipient was added.

This verifies the existing property-form route. The new general website forms require the supplied updated Apps Script code to be deployed. That update has not been made to the live account.

## Local code tests

Sixteen automated tests passed. They cover required data and consent, duplicate matching, website request types, saved-lead confirmation, three CRM writes, formula-text protection, request methods/origin, failure when the CRM is absent, and outreach exclusions for opt-outs and closed contacts.

The API and Apps Script were tested together for valuation, contact, and property-search requests with an in-memory Sheet adapter. This verifies the new code path locally. It is not a new Google production deployment.

The production build passed. The browser contact form correctly showed the phone/email fallback when no CRM URL was configured. No false saved message appeared.

## Still required in Angelo's account

- Compare with the actual current GitHub source and Vercel project.
- Set up or update the private John-owned CRM and deploy the updated script.
- Add the private server settings and test all three request types against that deployment.
- Confirm GSMLS site review and required display text.
- Deploy and run public-domain checks.

The Google sign-in reached phone verification. No Vercel change, GitHub push, public deployment, or new subscription was made.

