# Homepage refresh Preview

Preview-only redesign based on owner-approved recommendations. Baseline: main commit 47768c41d1f54b06a3016869a9b0988e3ee36f6d. Existing Vercel project and public domain remain unchanged.

Order: hero → search → selling → broker → compact service strip → selected past sales → communities → conversation CTA → contact.

- Reuses the owner-supplied 32 Columbus Avenue photo in the hero; this is an illustrative past-sale photo, not an active listing.
- Keeps the existing past-sale photos, addresses and prices unchanged. Closing prices and dates still need owner verification before any stronger claims about results or recency.
- Removes the separate repetitive buyer/seller photo panels and the unsupported numeric experience strip. No new performance claims are added.
- Replaces the unattributed testimonial with an honest service CTA until a verified review and permission/source are supplied.
- Removes the duplicate Properties nav item. Keeps Buy/Rent/Sell/Communities/About John/Contact.
- All six county cards open search with a validated county preselected. They do not initiate live RETS calls until Search is pressed.
- Home-value CTA opens the existing seller inquiry form with an explicit complimentary broker-review request. The inactive AVM dialog and provider adapter remain intact but are not promoted from the homepage.
- Adds Renting to contact interests, marks phone optional, adds a website-inquiry privacy notice and links it from forms/footer.
- Adds mobile Call John/Search homes shortcuts and keeps expanded homepage navigation in normal document flow.
- Lead API, Google CRM deployment, notifications, existing form reset behavior and IDX backend are unchanged.

Preview should be reviewed on desktop and mobile. Confirm section order, photo display, seller-intent prefill, contact controls, all county prefills, privacy page, no horizontal overflow, and menu open/close. No paid service or provider call is required to test this layout. Any real submission should use a unique marked TEST name and example.com email; avoid unnecessary duplicate test leads.

Outstanding owner content: genuine client review(s), confirmation of past closing prices/dates and business credentials, and any preferred local hero photograph. The privacy notice describes the current inquiry architecture; owner review is required before publishing it as the final notice.

Rollback: close this Preview PR or revert only its merge commit if later released. Do not roll back the Vercel production deployment or change credentials/domains for this Preview.
