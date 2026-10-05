# Daily operating guide

John handles property advice and client conversations. Angelo can maintain the website, assign follow-ups, and check that new inquiries reach the CRM.

## Start the day

1. Open the production CRM link recorded in the setup report.
2. In `Follow-Up Tasks`, review open tasks due today or earlier.
3. Open the matching `lead_id` in `Leads`. Read the message and activity history.
4. Assign one owner. Contact the person through the contact method they supplied.
5. Record the result, `last_touch_at`, and `next_follow_up_at` in `Leads`.
6. Mark a finished task `done`. Create the next open task if another follow-up is needed.

Changing a lead status does not automatically complete its tasks. Keep both up to date.

Use simple lead statuses such as `new`, `contacted`, `meeting booked`, `opportunity`, `closed`, `not interested`, and `do not contact`. Record the next action clearly. Stop outreach when someone opts out.

## Work each website request

For a valuation, read the address and contact details. John reviews the property and gives his opinion directly. Do not describe the website as an automatic valuation tool.

For a property inquiry, use the MLS number in the message. Verify current availability before arranging a viewing. Search covers active residential sales and rentals in Bergen, Essex, Hudson, Passaic, Monmouth, and Ocean counties. It shows up to six matches, not the full MLS inventory. Use a city or ZIP, county, price, and bedroom filter. Street-address search is not offered because the provider marks its street field as non-searchable.

For a general inquiry, read the requested service, assign the owner, and set a follow-up date.

## Warm outreach

Use only Scardino-owned contacts with a suitable existing relationship. Start with 10 contacts. Review each draft and send it yourself. The system does not auto-send, read WhatsApp replies, or maintain sending limits for you.

The existing WhatsApp workbook opens individual drafts from linked phone cells. Record the outcome in its status and notes columns.

The optional local generator uses `crm/sample-contacts.csv` as its sample format. It defaults to 10 rows. It excludes opted-out contacts and contacts marked sent, closed, not interested, or do not contact. Keep real input and output files in the ignored `private` folder. Import the output into your chosen queue only after review. Update the original contact status after each send before generating another batch.

Run `npm run generate:outreach` for the sample list. The generator accepts `input`, `output`, and `limit` command-line options. Angelo's setup report should record the exact command used with your private files. It creates drafts and links only.

## Content

Use `content/video-prompts.md` for short videos with John's experience. Use property images only when John has permission. A property post can link to the website or an active property form in the CRM. The code does not publish social posts or run advertisements.

## End the day

Check unassigned leads, overdue tasks, and `Errors`. Record basic daily totals in `Daily Metrics` if you use it. If backups are enabled, confirm that a recent CSV exists in the private backup folder.

Once a week, submit one clearly marked test inquiry through the live site. Confirm its lead reference in all three CRM tabs. Mark its task done and keep it out of sales reporting.

