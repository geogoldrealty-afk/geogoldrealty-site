# Geo Gold New Jersey lead engine

Prepared November 1, 2026. Scope: all 21 NJ counties, two agents, an editable private review queue, inbound request receipts and follow-up tasks.

## What is built

`automation/NjLeadEngine.gs` is an additive module for the existing John-owned, bound Google CRM Apps Script. It does not replace `Code.gs`, change website routes or read the MLS. It adds four tabs: NJ Lead Board, NJ Agents, NJ Suppression and NJ Automation Log. Existing Leads and Follow-Up Tasks are preserved.

The module imports up to 100 previously unprocessed CRM inquiries per run, keeps their original lead references, creates editable receipt drafts and ranks operational response priority using explicit inquiry, recency and recorded consent. It does not certify that someone is a qualified buyer or predict that they will transact. Phone/email syntax and wealth indicators cannot guarantee lead quality.

Agent assignment alternates by oldest assignment among active agents with at least five recorded sphere-of-influence contacts in the current UTC Monday-start week. Missing/stale activity sends the lead to BROKER-REVIEW rather than losing it. Two inactive placeholder rows are created; actual names must be supplied before activation. Existing assignments can be edited without changing the source CRM.

Automatic replies are fixed, reviewed inquiry acknowledgments. Edited drafts require `status=approved` and an `approved_by` name. Only recent direct website inquiries with recorded consent, a confirmed NJ state and an email are eligible. Imported MLS/skip-trace contacts are not eligible. Tour inquiries keep the existing tour receipt to prevent duplicate emails. Test records, suppressed recipients and uncertain prior deliveries are excluded. One send attempt is persisted before MailApp is called; uncertain delivery requires operator review, never blind retry. This chooses duplicate prevention over automatic retries that might send twice.

After 48 hours the board displays a follow-up due date and `task-only` status. No second marketing email is generated automatically. Reply detection, unsubscribe links, ongoing campaigns and SMS are not implemented. Suppression entries must be entered by the operator when someone asks to stop contact. Human review is required before any continuing marketing workflow is introduced.

## Installation and verification

1. Confirm the active private CRM spreadsheet and bound script are still the intended John-owned destination. Record the current script version. Do not install into the separate WhatsApp workbook or old publicly shared Scardino CRM.
2. Add `automation/NjLeadEngine.gs` as a NEW script file alongside the existing live code. Preserve its existing `doPost`, `saveLead_`, `onOpen` and deployment.
3. Run `ggNjSetup`. It preflights existing tab headers and refuses different columns. It creates only the four named tabs and inactive agent placeholders. Do not run the legacy CRM setup to do this.
4. Enter the two actual agent names/emails. Fill `active=yes`, `week_start` as Monday YYYY-MM-DD (UTC bookkeeping), and actual `weekly_soi_contacts`. Do not invent activity to satisfy the threshold.
5. Run `ggNjSync` with delivery still disabled. Check imported records, routing and editable drafts. The current website CRM does not persist structured state/county or unambiguous buyer/rental need. Confirm those fields on the board. Do not infer NJ from a free-form address or automatically classify by a word in a message.
6. Conduct an operator-approved test to a controlled mailbox using an explicitly designated test mode/copy. This release blocks test rows from automatic delivery. No actual lead or paid API is needed for the bundled tests.
7. To activate REAL inbound receipts only after checking recipients, use Script Properties `NJ_LEAD_DELIVERY_ENABLED=yes`. Leave `NJ_AUTO_REPLY_ENABLED` absent for manual approval; set it to `yes` only when fixed acknowledgments should send automatically. Do not enable on historical imported records without reviewing them.
8. Run `ggNjInstallTrigger` to refresh approximately every five minutes. It is idempotent and creates no duplicate trigger. Apps Script quotas can limit throughput; five minutes is approximate, not an SLA. Review the execution log and NJ Automation Log.

Changes to bound script time triggers do not require replacing the website web-app deployment. Existing incoming CRM submissions continue on their established path. This module polls persisted Leads; it adds no public intake endpoint.

## Daily operator workflow

Open NJ Lead Board. Confirm any missing geography and service type, check high-priority inquiries first, and review BROKER-REVIEW assignments. Edit a draft if needed, then enter your name in approved_by and change status to approved. Review delivery_status after processing. Call or personally follow up when due; record results in operator_notes and the existing CRM tasks. Add stop-contact requests to NJ Suppression immediately. Update each agent's activity once a week. Keep test records marked is_test=yes and exclude them from business reporting.

## Review of the supplied Gemini conversation

The goal is useful; the supplied snippets are incomplete. One uses Python `eval` on model output, several have broken indentation or invalid Airtable URLs, and the handlers have no authentication, deduplication, delivery ledger or error/status checks. None proves live integration. Do not deploy the snippets as supplied.

The attribution to “Team W” and its supposed exact lead-generation method is unverified. This implementation uses your requested accountability and lead-review concepts without attributing them as facts about that team.

The Smart Listing Program terms are unconfirmed. The reviewed draft offers a free comparative market analysis only. It makes no promise about commission, flexible cancellation, value, equity, guaranteed sale speed or net proceeds. Broker-approved program terms can be added later.

## Sources and costs checked

- Vercel Hobby is for noncommercial personal use: https://vercel.com/docs/plans/hobby and https://vercel.com/docs/limits/fair-use-guidelines . Check the existing account plan before choosing this as a commercial automation host. No plan was purchased or changed.
- Tracerfy documents billable lookups, a free synthetic sandbox, and snapshot propensity scores: https://www.tracerfy.com/skip-tracing-api-documentation/ . Scores are prioritization signals, not guaranteed intent. No live lookup or credit spend was made. No Tracerfy API route is invented here.
- GSMLS rule 11.5.6 limits IDX use to display; section 9.6 restricts other MLS-information uses: https://forms.gsmls.com/Rules/RulesRegs.pdf . Existing public-site approval does not itself establish permission to use the IDX feed to generate expired/cancelled-owner prospecting lists. Obtain the correct authorized data source and written scope for that use. Do not repurpose the shared RETS login or create competing sessions.
- Google Apps Script email quotas depend on account type: https://developers.google.com/apps-script/guides/services/quotas . MailApp uses existing authorization, with no new email provider subscription. The module limits delivery to 10 attempts per run and checks remaining daily quota.

## Remaining inputs and limits

Needed for installation/activation: current private CRM access/ownership verification; actual names/emails of both agents; broker confirmation of the offer. Needed for prospecting: provider-authorized lead source and its allowed uses, actual OneKey/NJMLS scope, and a separately approved Tracerfy usage budget/credentials if enrichment is wanted. Existing GSMLS display credentials are not enough to establish those rights. Do not paste secrets into chat.

OpenAI generation and Airtable synchronization are not active. The initial module uses editable reviewed templates and the CRM already in service to avoid paid calls and a second, potentially conflicting lead database. AI drafting may be added behind strict structured validation, human review, redacted inputs and a capped budget after account access and actual pricing are checked. All counties are accepted by the workflow; this does not mean a provider covers every county or that leads are already being generated there.

## Tests, release and rollback

Run `node --test tests/nj-lead-engine.test.mjs`. Tests use synthetic data and mocked Google services; no email, customer record, MLS session or paid API is contacted. Tests cover eligibility/rotation, stale activity, suppression/consent, source/geography checks, approvals, duplicate/uncertain sends, setup schema preservation and repeatable CRM sync.

Release is a separate review branch. No public-site merge or private-CRM install is implied by the source tests. To stop an installed version set NJ_LEAD_DELIVERY_ENABLED=no first and remove only the ggNjRun trigger. Retain the ledger and four tabs to preserve send history. Restore the prior script file version if needed; do not roll back Vercel production or delete existing CRM records.
