/* Add alongside the EXISTING bound CRM script. No replacement of Code.gs.
 * No external APIs, credentials, MLS queries or paid calls are used here.
 * Delivery stays off until NJ_LEAD_DELIVERY_ENABLED=yes is set in Script Properties.
 */
var GG_NJ = {
  primaryAgent: { agent_id:'GEO-SCARDINO', name:'Geo Scardino', email:'geogoldrealty@gmail.com', active:'yes' },
  counties: ['Atlantic','Bergen','Burlington','Camden','Cape May','Cumberland','Essex','Gloucester','Hudson','Hunterdon','Mercer','Middlesex','Monmouth','Morris','Ocean','Passaic','Salem','Somerset','Sussex','Union','Warren'],
  schemas: {
    'NJ Lead Board': ['lead_id','created_at','name','email','phone','state','county','lead_type','source','consent','priority','priority_reasons','assigned_agent','status','subject','draft','approved_by','sent_at','delivery_status','is_test','next_follow_up_at','follow_up_status','operator_notes'],
    'NJ Agents': ['agent_id','name','email','active','week_start','weekly_soi_contacts','last_assigned_at'],
    'NJ Suppression': ['email','reason','added_at'],
    'NJ Automation Log': ['created_at','lead_id','event','detail']
  }
};

function ggNjEmail_(value) {
  var email = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function ggNjWeek_(now) {
  // UTC Monday is used consistently for activity bookkeeping. Send times use NJ time.
  var date = new Date(now);
  date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
  return date.toISOString().slice(0, 10);
}

function ggNjPriority_(lead, now) {
  var score = 0, reasons = [];
  if (lead.consent === 'yes') { score += 20; reasons.push('Contact consent recorded'); }
  if (ggNjEmail_(lead.email)) { score += 10; reasons.push('Email format valid; ownership not independently verified'); }
  if (lead.source === 'geogold-website' || lead.source === 'geogold-buyer-portal') {
    score += 30; reasons.push('Direct website inquiry');
  }
  var age = new Date(now).getTime() - new Date(lead.created_at).getTime();
  if (age >= 0 && age < 86400000) { score += 15; reasons.push('Inquiry less than 24 hours old'); }
  if (['seller','buyer','rental','valuation','tour'].indexOf(lead.lead_type) >= 0) {
    score += 15; reasons.push('Explicit service requested');
  }
  // Operational priority, not a claim about wealth, creditworthiness or conversion probability.
  return { priority: score >= 70 ? 'high' : score >= 40 ? 'normal' : 'review', reasons: reasons.join('; ') };
}

function ggNjAgent_(agents, now) {
  var week = ggNjWeek_(now);
  var active = agents.filter(function(a) {
    return a.active === 'yes' && a.name && ggNjEmail_(a.email);
  });
  // With one agent there is no competitive lead distribution to qualify for.
  if (active.length === 1) return active[0].agent_id;
  var eligible = active.filter(function(a) {
    return String(a.week_start).slice(0, 10) === week && Number(a.weekly_soi_contacts) >= 5;
  });
  eligible.sort(function(a,b) {
    return (Date.parse(a.last_assigned_at) || 0) - (Date.parse(b.last_assigned_at) || 0) ||
      String(a.agent_id).localeCompare(String(b.agent_id));
  });
  return eligible.length ? eligible[0].agent_id : 'BROKER-REVIEW';
}

function ggNjDraft_(lead) {
  var opening = 'Thank you for contacting Geo Gold Realty about your New Jersey real estate plans.';
  var next = 'What towns are you considering, and when would you like to move?';
  if (lead.lead_type === 'seller' || lead.lead_type === 'valuation') {
    opening = 'Thank you for your New Jersey home-selling inquiry.';
    next = 'Our local experts can prepare a free comparative market analysis. What is the property address and your preferred time to talk?';
  } else if (lead.lead_type === 'rental') {
    next = 'What towns, monthly rent range, bedroom count and move-in date should we use for your rental search?';
  } else if (lead.lead_type === 'tour') {
    next = 'We received your showing request. Geo Gold Realty will contact you to confirm availability and the appointment.';
  }
  return { subject: 'Geo Gold Realty: Your New Jersey inquiry', body: [
    'Hello ' + (String(lead.name || '').trim() || 'there') + ',', '', opening, next, '',
    'Geo Gold Realty Group LLC', 'geogoldrealty@gmail.com', '(201) 826-5730'
  ].join('\n') };
}

function ggNjDeliveryDecision_(lead, config, suppressed, now) {
  if (config.enabled !== true) return 'delivery-disabled';
  if (lead.is_test === 'yes') return 'test-record';
  if (lead.status === 'phone-follow-up') return 'phone-preferred';
  if (config.activatedAt && Date.parse(lead.created_at) < Date.parse(config.activatedAt)) return 'before-activation';
  if (lead.sent_at || ['sending','sent','unknown'].indexOf(lead.delivery_status) >= 0) return 'already-attempted';
  var email = ggNjEmail_(lead.email);
  if (!email) return 'missing-email';
  if (suppressed.indexOf(email) >= 0) return 'suppressed';
  if (lead.consent !== 'yes') return 'missing-consent';
  if (lead.state !== 'NJ') return 'state-needs-review';
  if (['geogold-website','geogold-buyer-portal'].indexOf(lead.source) < 0) return 'source-needs-review';
  if (lead.lead_type === 'tour') return 'existing-tour-receipt';
  var age = new Date(now).getTime() - Date.parse(lead.created_at);
  if (!Number.isFinite(age) || age < 0 || age > 7 * 86400000) return 'stale-inquiry';
  if (!lead.subject || !lead.draft) return 'missing-draft';
  if (lead.status === 'approved' && String(lead.approved_by || '').trim()) return 'send';
  // Automatic replies use the fixed, reviewed receipt only. Edited drafts require approval.
  var draft = ggNjDraft_(lead);
  if (config.autoReply === true && lead.status === 'pending-review' &&
      lead.subject === draft.subject && lead.draft === draft.body) return 'send';
  return 'needs-approval';
}

function ggNjRows_(name) {
  var sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('Missing required sheet: ' + name);
  var rows = sh.getDataRange().getValues();
  var headers = rows.shift().map(String);
  return rows.map(function(row, index) {
    var result = { _row: index + 2 };
    headers.forEach(function(key,i) { result[key] = row[i] instanceof Date ? row[i].toISOString() : row[i]; });
    return result;
  }).filter(function(row) { return headers.some(function(key) { return row[key] !== ''; }); });
}

function ggNjCell_(value) {
  return typeof value === 'string' && /^[=+@-]/.test(value) ? "'" + value : value == null ? '' : value;
}

function ggNjAppend_(name, row) {
  SpreadsheetApp.getActive().getSheetByName(name).appendRow(GG_NJ.schemas[name].map(function(key) { return ggNjCell_(row[key]); }));
}

function ggNjUpdate_(name, row) {
  SpreadsheetApp.getActive().getSheetByName(name).getRange(row._row, 1, 1, GG_NJ.schemas[name].length)
    .setValues([GG_NJ.schemas[name].map(function(key) { return ggNjCell_(row[key]); })]);
}

function ggNjLog_(id, event, detail) {
  // Do not log contact information, message bodies or exception objects.
  ggNjAppend_('NJ Automation Log', { created_at: new Date().toISOString(), lead_id:id, event:event, detail:detail });
}

function ggNjSetup() {
  var ss = SpreadsheetApp.getActive();
  // Check every existing schema before creating or changing anything.
  Object.keys(GG_NJ.schemas).forEach(function(name) {
    var sh = ss.getSheetByName(name);
    if (sh && sh.getLastRow() && sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].join('|') !== GG_NJ.schemas[name].join('|')) {
      throw new Error('Existing columns differ in ' + name + '. Review before installation.');
    }
  });
  Object.keys(GG_NJ.schemas).forEach(function(name) {
    var sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (!sh.getLastRow()) sh.appendRow(GG_NJ.schemas[name]);
    sh.setFrozenRows(1);
    sh.getRange(1,1,1,GG_NJ.schemas[name].length).setBackground('#171717').setFontColor('#ffffff').setFontWeight('bold');
  });
  if (!ggNjRows_('NJ Agents').length) {
    ggNjAppend_('NJ Agents', Object.assign({},GG_NJ.primaryAgent,{weekly_soi_contacts:0}));
  }
  return 'NJ lead board ready. Delivery remains disabled until configured.';
}

function ggNjClassify_(raw) {
  var campaign = String(raw.campaign || raw.request_type || '').toLowerCase();
  var type = /tour/.test(campaign) ? 'tour' : /valuation/.test(campaign) ? 'valuation' : /seller/.test(campaign) ? 'seller' : 'general';
  // Avoid inferring rental intent from words in a free-form message.
  if (raw.lead_type === 'rental' || raw.lead_type === 'buyer') type = raw.lead_type;
  return type;
}

function ggNjMetadata_(raw) {
  var first = String(raw.message || '').split('\n')[0];
  if (first.indexOf('GEO_GOLD_INQUIRY_META:') !== 0) return {};
  try {
    var metadata=JSON.parse(first.slice('GEO_GOLD_INQUIRY_META:'.length));
    return { state:metadata.state === 'NJ' ? 'NJ' : '', contactPreference:metadata.contactPreference === 'phone' ? 'phone' : '',
      lead_type:['buyer','rental','seller','valuation','general'].indexOf(metadata.lead_type) >= 0 ? metadata.lead_type : '' };
  } catch (error) { return {}; }
}

function ggNjSync() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return 'Already running';
  try {
    var now = new Date(), agents = ggNjRows_('NJ Agents'), board = ggNjRows_('NJ Lead Board');
    var known = new Set(board.map(function(row) { return String(row.lead_id); }));
    var count = 0;
    ggNjRows_('Leads').filter(function(raw) { return raw.lead_id && !known.has(String(raw.lead_id)); }).slice(-100).forEach(function(raw) {
      var metadata=ggNjMetadata_(raw);
      var lead = {
        lead_id:String(raw.lead_id),created_at:String(raw.created_at || ''),name:String(raw.full_name || ''),
        email:ggNjEmail_(raw.email),phone:String(raw.phone || ''),state:String(raw.state || metadata.state || '').toUpperCase(),
        county:GG_NJ.counties.indexOf(raw.county) >= 0 ? raw.county : '', lead_type:metadata.lead_type || ggNjClassify_(raw),
        source:String(raw.source || ''),consent:String(raw.consent || '').toLowerCase(),status:metadata.contactPreference === 'phone' ? 'phone-follow-up' : 'pending-review',
        delivery_status:'not-sent',is_test:/^TEST\b/i.test(String(raw.full_name || '')) || /@example\.(com|net|org)$/i.test(String(raw.email || '')) ? 'yes' : 'no',
        next_follow_up_at:new Date(now.getTime() + 48 * 3600000).toISOString(),follow_up_status:'task-only'
      };
      // The current CRM does not persist state/county. Leave missing geography for an operator to confirm.
      var priority = ggNjPriority_(lead, now), draft = ggNjDraft_(lead);
      lead.priority = priority.priority; lead.priority_reasons = priority.reasons;
      lead.subject = draft.subject; lead.draft = draft.body;
      lead.assigned_agent = ggNjAgent_(agents, now);
      ggNjAppend_('NJ Lead Board',lead); known.add(lead.lead_id); count++;
      var agent = agents.find(function(a) { return a.agent_id === lead.assigned_agent; });
      if (agent) { agent.last_assigned_at = now.toISOString(); ggNjUpdate_('NJ Agents',agent); }
      ggNjLog_(lead.lead_id,'lead-prepared',lead.state === 'NJ' ? 'ready-for-review' : 'confirm-state');
    });
    return 'Prepared ' + count + ' inquiries.';
  } finally { lock.releaseLock(); }
}

function ggNjSendApproved() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) return 'Already running';
  try {
    var properties = PropertiesService.getScriptProperties();
    var config = {enabled:properties.getProperty('NJ_LEAD_DELIVERY_ENABLED') === 'yes',autoReply:properties.getProperty('NJ_AUTO_REPLY_ENABLED') === 'yes',activatedAt:properties.getProperty('NJ_LEAD_ACTIVATED_AT')};
    if (!Number.isFinite(Date.parse(config.activatedAt))) return 'Activation date missing; no email sent.';
    var suppressed = ggNjRows_('NJ Suppression').map(function(row) { return ggNjEmail_(row.email); });
    var rows = ggNjRows_('NJ Lead Board'), attempted = 0;
    rows.forEach(function(lead) {
      if (attempted >= 10 || ggNjDeliveryDecision_(lead,config,suppressed,new Date()) !== 'send') return;
      if (MailApp.getRemainingDailyQuota() < 1) return;
      // Persist intent before transmission. An uncertain result is never retried automatically.
      lead.delivery_status = 'sending'; ggNjUpdate_('NJ Lead Board',lead); SpreadsheetApp.flush(); attempted++;
      try {
        MailApp.sendEmail({to:lead.email,replyTo:'geogoldrealty@gmail.com',name:'Geo Gold Realty',subject:lead.subject,body:lead.draft});
        lead.sent_at = new Date().toISOString(); lead.delivery_status = 'sent'; lead.status = 'contacted';
      } catch (error) {
        lead.delivery_status = 'unknown'; lead.status = 'delivery-review';
      }
      ggNjUpdate_('NJ Lead Board',lead);
      ggNjLog_(lead.lead_id,'delivery-attempt',lead.delivery_status);
    });
    return 'Attempted ' + attempted + ' receipts.';
  } finally { lock.releaseLock(); }
}

function ggNjRun() { ggNjSync(); ggNjSendApproved(); }

function ggNjActivateInbound() {
  var properties=PropertiesService.getScriptProperties();
  if (!properties.getProperty('NJ_LEAD_ACTIVATED_AT')) properties.setProperty('NJ_LEAD_ACTIVATED_AT',new Date().toISOString());
  ggNjInstallTrigger();
  properties.setProperty('NJ_AUTO_REPLY_ENABLED','yes');
  properties.setProperty('NJ_LEAD_DELIVERY_ENABLED','yes');
  console.log('Inbound receipts enabled; activation cutoff recorded; refresh trigger installed.');
}

function ggNjInstallTrigger() {
  // Explicit operator action. Setup alone does not install a background job.
  if (!ScriptApp.getProjectTriggers().some(function(trigger) { return trigger.getHandlerFunction() === 'ggNjRun'; })) {
    ScriptApp.newTrigger('ggNjRun').timeBased().everyMinutes(5).create();
  }
  return 'NJ lead board will refresh approximately every five minutes.';
}
