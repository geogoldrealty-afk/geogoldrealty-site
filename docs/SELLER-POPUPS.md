# Seller popups

The home page's two seller buttons open native accessible dialogs. Escape and Close dismiss them; focus returns to the opener. The estimate layout shows the matched address, available home facts, sourced value, value range, date, and explanation. No example property value is shown to visitors.

## Valuation connection still required

The owner confirmed there is no valuation service account yet. Google Places provides addresses, not home estimates. No service has been purchased or activated. No live AVM lookup has been tested.

An optional ATTOM adapter is prepared from https://api.developer.attomdata.com/docs using the documented /attomavm/detail endpoint. Before enabling it, the owner must select a service/plan that allows public website display and approve its costs. If a different service is selected, replace the adapter. Confirm actual response samples, address matching, display/attribution requirements, permitted retention, and coverage with that provider. Add abuse/rate limiting appropriate to the chosen plan before public activation.

Only after that review, configure server-only ATTOM_API_KEY, VALUATION_PROVIDER=attom and VALUATION_ENABLED=true. Never use VITE_ settings or commit a key. The adapter stays disabled by default. Until enabled, the popup clearly offers a custom CMA instead of inventing an estimate. The card's happy path was tested with synthetic data only. No property photo is fabricated or borrowed from another listing.

## Seller inquiries and notification compatibility

The seller form sends kind=seller-contact to /api/leads. Server validation requires name, email, property information, consent and contact preference. Phone is optional unless the visitor chooses phone contact. Preference and property info are retained in the CRM message; campaign=seller-contact identifies these leads.

The currently installed CRM emails property-search requests to the approved Geo Gold address. The API deliberately uses that existing request_type as a compatibility transport for seller inquiries, with an explicit SELLER INQUIRY message prefix. No CRM schema, existing leads, or Apps Script deployment is changed by this PR. Its existing email subject may still say property inquiry. A returned saved lead reference confirms saving, not email delivery; Google may log delivery errors separately.

## Verification

Four local automated tests passed: validation, preserving preference/content, the existing notification route, failure without a saved lead reference, and disabled valuation. Vercel Preview build passed for commit 2889a9c57764219b1b41074f10216780c1fd01fa, deployment 9KaoM3Gqh9gX9vWxYqFpBQHeCjbs.

Browser checks confirmed both dialogs open, Escape closes the dialog and restores focus, an address is carried from the value popup into the seller form, the phone becomes required when phone contact is selected, and the unavailable-provider response contains no value. No successful mobile viewport override was established; mobile visual QA remains pending.

One marked synthetic seller inquiry, TEST SELLER POPUP 20261015-2248, was submitted from Preview. The saved-lead success path closed the popup. A matching notification was read back in geogoldrealty@gmail.com, subject "New Geo Gold property inquiry: TEST SELLER POPUP 20261015-2248". It contains the seller message and property information. Direct CRM lead/task/activity row readback and test-task cleanup remain pending; do not claim those were inspected. The selected owner-owned CRM is GeoGold Realty CRM; its private link is not included in this public repository.

Production remains unchanged until owner approval. Roll back by reverting this feature commit. No Production environment setting has been changed.

