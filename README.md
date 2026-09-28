# GeoGold website and CRM handoff

Prepared for John Scardino Jr. and Angelo on 28 September 2026.

The repairs are built locally. The public website has not been changed.

Start with `docs/START-HERE.md`. Angelo can paste `docs/ANGELO-CODEX-PROMPT.md` into Codex, with this project folder open and the separate private settings file available locally.

## Included

- The current public website design, with repaired JavaScript loading.
- Live GSMLS sale and rental search, photos, filters, and property inquiry buttons.
- Valuation and contact forms, consent, validation, and clear saved/error states.
- A private server route that sends forms to the Google Sheets CRM.
- Updated Apps Script files for website requests and existing property links.
- CRM templates, a manual outreach draft generator, and video prompts.
- Operator instructions, setup instructions, test evidence, and a troubleshooting guide.

## Run locally

Use Node.js 22 or later. Open a terminal in this folder.

```sh
npm ci
npm test
npm run build
npm run dev
```

The preview opens at `http://127.0.0.1:4173`. Run `node scripts/import-private-settings.js ../PRIVATE-SETTINGS.env` to load only server settings into an ignored `.env.local`. Adjust the path if the private file is elsewhere. Leave `CRM_WEB_APP_URL` unset until the updated Apps Script deployment is ready. Do not place an account password in Vercel.

The general project ZIP has no credentials or real contact exports. Keep `PRIVATE-SETTINGS.env` outside this folder.

