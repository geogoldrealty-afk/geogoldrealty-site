# Which spreadsheet is the CRM?

John shared a contact list on Friday, 25 September. There is also a separate lead CRM. They serve different purposes and are not automatically linked.

## The WhatsApp contact list

[Open John WhatsApp Contacts - Special Friends + Real Geeks](https://docs.google.com/spreadsheets/d/1rbVWz5_AL3tLgp8MDHu2hso0W1CKVJymJPohm6jPoiQ/edit).

This workbook has `WhatsApp Contacts` and `Summary` tabs. It holds John's relationship contacts and an earlier Real Geeks lead export. A Real Geeks link points back to that service. It does not prove that Real Geeks is active or connected to this website.

The original generator adds WhatsApp links to phone cells. A link opens a message draft. John or Angelo must review it and press Send. Use `Lead Status` and `Notes` to record the outcome. The sheet does not detect replies or know that a message was sent.

A new website inquiry does not appear in this list automatically.

## The existing lead CRM

[Open Scardino Free Facebook CRM](https://docs.google.com/spreadsheets/d/1m3OXMSMfk8LCp2op-dBsEkGOTjXYH8AVzKTCCSb2FQM/edit).

This is a Google Sheets and Apps Script system. The existing version receives inquiries from property-specific links. It is separate from Facebook Messenger and from the MLS feed.

| Tab | Purpose |
| --- | --- |
| Leads | The person's contact details, request, owner, status, and next follow-up |
| Properties | Properties John can advertise, with form links |
| Follow-Up Tasks | The next action, owner, due date, and task status |
| Activity Log | Records when inquiries arrive |
| Daily Metrics | A reporting structure. The supplied code does not calculate these totals automatically. |
| Config | Alert recipient, web app URL, backup folder, and timezone |
| Errors | Failed operations recorded by Apps Script |
| Owner Imports | Property-owner records from approved sources. This is not a phone or email enrichment service. |

The existing CRM was visible to anyone with its link when checked. It must not be used as a public store for future private leads. The handoff setup uses a private John-owned destination and keeps the existing sheet intact. Do not copy real records into a new destination without checking access and the intended owners.

## The repaired website flow

Visitor submits a request → Vercel checks the fields → Apps Script saves it → Google Sheets holds a lead, task, and activity entry → John or Angelo follows up.

The website shows a saved message only when the CRM returns a lead reference. It shows an error and John's phone/email when saving cannot be confirmed.

A valuation request asks John to review the property. It does not produce an automated price. A home-search visitor can view live listings without giving contact details. Their details enter the CRM only when they submit an inquiry.

Repeat inquiries with a matching email or phone update the existing lead and create another task and activity entry. Check earlier activity before contacting the person.

## Alerts and backups

Adonis's alert recipient remains blank. No notification was restored.

The daily digest needs an approved recipient in `Config`. Immediate alerts need both a recipient and `immediate_alerts=yes`. The supplied setup starts with no recipient. John can choose his own alert destination during setup.

CSV backups need a private Drive folder ID in `backup_folder_id`. A scheduled trigger alone does not prove that backups exist. Check a saved file after enabling this setting.

