# Start here

This handoff contains the website repair, the CRM code, and operating instructions. It replaces the need to remember what was said in the setup calls.

## Files to send Angelo

1. `GeoGold-Takeout-2026-09-28.zip` contains code, tests, and guides.
2. `PRIVATE-SETTINGS.env` contains the saved account and MLS settings. Send it directly to Angelo as a separate attachment. Keep it outside the extracted project and out of Git.
3. `ANGELO-CODEX-PROMPT.md` contains the final setup task. It is also inside the ZIP.

Unzip the project, open it in Codex, and paste the setup prompt. Codex must compare this package with the current GitHub repository before applying it. The public site was rebuilt by Angelo, and the older Scardino React project is a different codebase.

## What is ready

The local website can search the real GSMLS feed. Sale listings, rentals, city search, photos, and no-results responses were verified. The new forms and CRM code pass local tests. The existing live CRM accepted one marked test and created a lead, a follow-up task, and an activity record.

## What Angelo still needs to complete

- Open the correct existing GitHub and Vercel accounts.
- Install the updated Apps Script code in a private, John-owned CRM, or update an existing suitable John-owned CRM after checking ownership and access.
- Set the new CRM web app URL in Vercel and add the private GSMLS server settings.
- Test the preview forms and confirm the saved CRM rows.
- Confirm the current GSMLS site approval and required display wording, then deploy to the existing website project.
- Test the public website after deployment.

The saved GSMLS login works. This does not prove that GSMLS has finished its site approval. The current local records still list that review as open.

## Which guide to use

| Need | File |
| --- | --- |
| Use the site, work leads, and send warm outreach | `OPERATING-GUIDE.md` |
| Understand the two spreadsheets | `CRM-EXPLAINER.md` |
| Install, deploy, or restore a previous version | `SETUP-AND-RECOVERY.md` |
| See what was checked and what remains open | `VERIFICATION.md` |
| Ask Codex to complete the setup | `ANGELO-CODEX-PROMPT.md` |

No message was sent to John or Angelo during this work. No paid service was activated.

