/* Explicit operator-only test. Fixed recipient. Never changes delivery settings. */
function ggNjSendOperatorTest() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) throw new Error('Another CRM operation is running.');
  try {
    var id = 'NJ-OPERATOR-TEST-20261102';
    var existing = ggNjRows_('NJ Lead Board').find(function(row) { return row.lead_id === id; });
    if (existing) {
      console.log('Operator test already recorded: ' + existing.delivery_status + '. No email retried.');
      return existing.delivery_status;
    }
    if (MailApp.getRemainingDailyQuota() < 1) throw new Error('No email quota available. No test sent.');
    var now = new Date().toISOString();
    var lead = {lead_id:id,created_at:now,name:'TEST Geo Gold operator',email:'geogoldrealty@gmail.com',
      state:'NJ',lead_type:'buyer',source:'operator-test',consent:'yes',priority:'review',
      priority_reasons:'Synthetic operator test; excluded from business reporting',assigned_agent:'GEO-SCARDINO',
      status:'test-in-progress',subject:'TEST — Geo Gold NJ inquiry receipt — ' + id,
      approved_by:'Operator approval in chat',delivery_status:'sending',is_test:'yes',
      follow_up_status:'completed',operator_notes:'No showing or customer inquiry was created.'};
    lead.draft = 'This is the authorized Geo Gold CRM email test. No appointment has been booked.\n\n' +
      ggNjDraft_({name:'Geo',lead_type:'buyer'}).body + '\n\nTest reference: ' + id;
    ggNjAppend_('NJ Lead Board',lead);
    SpreadsheetApp.flush();
    lead = ggNjRows_('NJ Lead Board').find(function(row) { return row.lead_id === id; });
    try {
      MailApp.sendEmail({to:'geogoldrealty@gmail.com',replyTo:'geogoldrealty@gmail.com',name:'Geo Gold Realty',subject:lead.subject,body:lead.draft});
      lead.sent_at = new Date().toISOString(); lead.delivery_status = 'sent'; lead.status = 'test-completed';
    } catch (error) {
      lead.delivery_status = 'unknown'; lead.status = 'delivery-review';
    }
    ggNjUpdate_('NJ Lead Board',lead);
    ggNjLog_(id,'operator-test',lead.delivery_status);
    var props=PropertiesService.getScriptProperties();
    console.log('Operator test ' + id + ': ' + lead.delivery_status +
      '; customer delivery enabled=' + (props.getProperty('NJ_LEAD_DELIVERY_ENABLED') === 'yes') +
      '; auto replies enabled=' + (props.getProperty('NJ_AUTO_REPLY_ENABLED') === 'yes'));
    return lead.delivery_status;
  } finally { lock.releaseLock(); }
}
