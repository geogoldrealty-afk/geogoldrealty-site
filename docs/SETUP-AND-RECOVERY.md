# Setup and recovery

## Architecture

The website uses Vite with plain HTML, CSS, and JavaScript. Vercel serves the page and runs two server functions. GSMLS supplies live property data through RETS. Google Apps Script writes inquiries to Google Sheets.

`index.html` imports `app.js` as a module. Vite includes it in the build. The previous public page referenced a missing script, which left its forms without working behavior.

`api/idx/listings.js` authenticates on the server and returns listing data. `api/leads.js` checks requests and forwards approved fields to Apps Script. Neither route returns credentials to the visitor.

## Install the CRM under John's control

First inspect any CRM that John already owns. Reuse it when it is the intended destination and its sharing is suitable. Back up its current script before editing. Preserve existing rows, columns, IDs, configuration, and triggers.

If the earlier Adonis-owned sheet is the only CRM, create a private Google Sheet under John's account. This requires account access. Give it a clear name such as `GeoGold Realty CRM`. Do not make its lead rows public. Record its link in the final setup report.

Open Extensions, then Apps Script. Add the four files from `apps-script`. Keep the script bound to the chosen sheet. Run `setupCrm` and complete Google's account permission flow. Review the eight created tabs. Do not overwrite an existing sheet with different headers without mapping it first.

Deploy a web app that runs as the owner and permits the website's server to submit inquiries. Public access to the submission form does not require public access to the spreadsheet. Record the deployment URL ending in `/exec`. A new web app access grant may require owner confirmation.

Set `Config.web_app_url` to that URL if property links will be used. Add only real properties that John can advertise to `Properties`, set them active, and run Create property links. Do not publish the sample NJ-001 link as a real listing.

Leave `alert_email` blank unless John selects his recipient. Do not add Adonis. Add a private backup folder only if backups are wanted. Setup creates digest and backup triggers, but they do no delivery work without the relevant settings.

## Private server settings

The separate `PRIVATE-SETTINGS.env` includes the saved account data and GSMLS values. Account passwords stay on the local machine. Add only these settings to the existing Vercel project:

- `GSMLS_RETS_LOGIN_URL`
- `GSMLS_RETS_USERNAME`
- `GSMLS_RETS_PASSWORD`
- `GSMLS_RETS_USER_AGENT`
- `GSMLS_RETS_USER_AGENT_PASSWORD`
- `CRM_WEB_APP_URL`, using the newly checked CRM deployment

Never give these a `VITE_` prefix. Use the same private settings in preview and production as needed. The old CRM URL in the private file is reference only; its deployed version has not received the new website-request code.

## Deploy

Inspect the live Vercel project's connected GitHub repo, branch, root directory, domain, and last good deployment. Save those details. The old local project ID is a historical reference, not proof of the current domain mapping.

Compare this package with the current repository. Preserve newer edits. Put the website files and the `api` directory in the same Vercel project root. Use Vite, `npm run build`, and output directory `dist`. Do not deploy only the `dist` folder, because that would omit the server functions.

Run `npm ci`, `npm test`, and `npm run build`. Create a preview and test it before production. Confirm current MLS display approval and disclosure requirements. Retain the listing broker name and contact on every result.

On the preview, test a sale, rental, city, ZIP, price/bedroom filter, and no-results case. Submit one marked request for each form type. Confirm a lead, task, and activity record, then verify failure behavior with an unavailable CRM in a test environment. Do not treat a success message alone as proof.

Deploy to the existing `geogoldrealty.com` project, then repeat a search and one marked form submission on the public domain. Record commit, deployment URL, CRM URL, and test references in a setup report.

## Troubleshooting

| Problem | Check |
| --- | --- |
| Search returns 404 | The API folder is missing or Vercel is building the wrong root. |
| Search returns 502 | Check the five GSMLS settings and provider access. Do not print credentials or raw authentication logs. |
| No matching homes | Remove filters. Try a known city or ZIP. Search shows a limited set of matches. |
| A form says requests are unavailable | `CRM_WEB_APP_URL` is absent or is not a supported Apps Script `/exec` URL. |
| A form cannot confirm saving | Check the Apps Script deployment version, access, `Errors`, and whether a lead was already saved before retrying. |
| The CRM has a row but the website shows an error | Confirm the web app returns JSON with `ok=true` and `lead_id`. Do not substitute a fake success response. |
| No daily digest | Check the recipient and trigger. A blank recipient is intentional until John chooses one. |
| No backup | Check `backup_folder_id`, Drive access, and the backup trigger. |
| Mobile menu will not open | Confirm the JavaScript bundle loads successfully. |

## Restore a previous version

Use the last good Vercel deployment or revert the repair commit in the existing GitHub repo. Keep private settings in Vercel. Restore the saved Apps Script version if its change caused the problem. Do not delete CRM rows, the domain, or the project to roll back a website repair.

The package includes external image and font URLs already used by the live design. Those services remain dependencies. Images and business claims inherited from the site were not re-licensed or re-audited in this repair.

