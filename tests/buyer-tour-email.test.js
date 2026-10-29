import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

function loadCrm() {
  const emails = [];
  const activities = [];
  const errors = [];
  const headers = {
    'Activity Log': ['event_id', 'created_at', 'lead_id', 'event_type', 'actor', 'property_id', 'details'],
    Errors: ['error_id', 'created_at', 'operation', 'lead_id', 'message', 'payload_json', 'resolved', 'resolution_notes'],
  };
  const makeSheet = name => ({
    getLastColumn: () => headers[name].length,
    getRange: () => ({ getValues: () => [headers[name]] }),
    appendRow: row => {
      const record = Object.fromEntries(headers[name].map((header, index) => [header, row[index]]));
      if (name === 'Activity Log') activities.push(record);
      if (name === 'Errors') errors.push(record);
    },
  });
  const context = vm.createContext({
    MailApp: { sendEmail: message => emails.push(message) },
    Utilities: { getUuid: () => 'activity-id' },
    SpreadsheetApp: { getActive: () => ({ getSheetByName: name => headers[name] ? makeSheet(name) : null }) },
  });
  vm.runInContext(readFileSync(new URL('../apps-script/Code.gs', import.meta.url), 'utf8'), context);
  return { context, emails, activities, errors };
}

test('buyer tour request sends a clear receipt, not an appointment confirmation', () => {
  const { context, emails, activities, errors } = loadCrm();
  const sent = vm.runInContext(`sendBuyerTourReceipt_(
    { source: 'geogold-buyer-portal', consent: 'yes', tour_type: 'private-tour', tour_preferred_at: '2026-11-02T10:00:00.000Z', property_address: 'MLS #4023510' },
    { lead: { lead_id: 'LEAD-1', first_name: 'Avery', full_name: 'Avery Buyer', email: 'avery@example.com', property_id: 'WEBSITE-property-search' } }
  )`, context);

  assert.equal(sent, true);
  assert.equal(emails.length, 1);
  assert.equal(emails[0].to, 'avery@example.com');
  assert.match(emails[0].subject, /tour request/i);
  assert.match(emails[0].body, /not a confirmed appointment/i);
  assert.equal(activities[0].event_type, 'buyer_tour_receipt_sent');
  assert.deepEqual(errors, []);
});

test('buyer receipt is not sent without portal source and consent', () => {
  const { context, emails } = loadCrm();
  const sent = vm.runInContext(`sendBuyerTourReceipt_(
    { source: 'geogold-website', consent: 'yes' },
    { lead: { email: 'avery@example.com' } }
  )`, context);
  assert.equal(sent, false);
  assert.equal(emails.length, 0);
});

