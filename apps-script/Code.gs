const SHEETS = {
  leads: 'Leads',
  properties: 'Properties',
  tasks: 'Follow-Up Tasks',
  activity: 'Activity Log',
  metrics: 'Daily Metrics',
  config: 'Config',
  errors: 'Errors',
  owners: 'Owner Imports',
};

const HEADERS = {
  Leads: ['lead_id','created_at','updated_at','first_name','last_name','full_name','email','phone','normalized_email','normalized_phone','property_id','property_address','source','campaign','message','consent','consent_at','status','owner','submission_count','last_touch_at','next_follow_up_at','notes'],
  Properties: ['property_id','address','municipality','county','state','postal_code','listing_url','image_url','status','facebook_post_url','campaign','form_link','created_at','notes'],
  'Follow-Up Tasks': ['task_id','lead_id','created_at','due_at','owner','priority','status','next_action','property_id','notes'],
  'Activity Log': ['event_id','created_at','lead_id','event_type','actor','property_id','details'],
  'Daily Metrics': ['metric_date','new_leads','repeat_inquiries','open_tasks','contacted','meetings_booked','opportunities','closed','errors'],
  Config: ['key','value','description'],
  Errors: ['error_id','created_at','operation','lead_id','message','payload_json','resolved','resolution_notes'],
  'Owner Imports': ['import_id','imported_at','source_name','source_url','tax_year','county','municipality','block','lot','qualifier','property_address','owner_name','owner_mailing_address','property_class','assessed_land','assessed_improvement','assessed_total','record_status','source_record_id','notes'],
};

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Scardino CRM')
    .addItem('Run setup', 'setupCrm')
    .addItem('Create property links', 'refreshPropertyLinks')
    .addItem('Send daily digest', 'sendDailyDigest')
    .addItem('Create CSV backup', 'createCsvBackup')
    .addToUi();
}

function setupCrm() {
  const ss = SpreadsheetApp.getActive();
  Object.entries(HEADERS).forEach(([name, headers]) => ensureSheet_(ss, name, headers));
  seedConfig_(ss.getSheetByName(SHEETS.config));
  installDailyTrigger_('sendDailyDigest', 17);
  installDailyTrigger_('createCsvBackup', 2);
  return 'Scardino CRM setup is complete. Deploy this script as a web app, then run Create property links.';
}

function doGet(event) {
  const propertyId = String((event && event.parameter && event.parameter.property_id) || '').trim();
  const property = getProperty_(propertyId);
  const template = HtmlService.createTemplateFromFile('Index');
  template.property = property;
  template.propertyId = propertyId;
  template.source = String((event && event.parameter && event.parameter.source) || 'facebook-organic');
  template.campaign = String((event && event.parameter && event.parameter.campaign) || (property && property.campaign) || '');
  template.prefill = {
    first_name: String((event && event.parameter && event.parameter.first_name) || ''),
    last_name: String((event && event.parameter && event.parameter.last_name) || ''),
    email: String((event && event.parameter && event.parameter.email) || ''),
    phone: String((event && event.parameter && event.parameter.phone) || ''),
    message: String((event && event.parameter && event.parameter.message) || ''),
  };
  return template.evaluate()
    .setTitle(property ? `Ask about ${property.address}` : 'Property inquiry')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(event) {
  try {
    const payload = event && event.parameter ? event.parameter : {};
    const result = submitLead(payload);
    return json_(result);
  } catch (error) {
    recordError_('doPost', '', error, event && event.parameter);
    return json_({ ok: false, error: error.message });
  }
}

function submitLead(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const requestType = String(payload.request_type || '');
    const websiteTypes = ['valuation', 'contact', 'property-search'];
    const property = websiteTypes.includes(requestType)
      ? { property_id: `WEBSITE-${requestType}`, address: String(payload.property_address || (requestType === 'valuation' ? '' : 'General website inquiry')), status: 'active' }
      : getProperty_(payload.property_id);
    if (requestType === 'valuation' && !String(payload.property_address || '').trim()) throw new Error('Property address is required.');
    const leadSheet = getSheet_(SHEETS.leads);
    const existing = rowsAsObjects_(leadSheet);
    const result = LeadCore.prepareSubmission(payload, property, existing, new Date());
    if (result.action === 'update') updateById_(leadSheet, 'lead_id', result.lead.lead_id, result.lead);
    else appendObject_(leadSheet, result.lead);
    appendObject_(getSheet_(SHEETS.tasks), result.task);
    appendObject_(getSheet_(SHEETS.activity), {
      event_id: Utilities.getUuid(), created_at: new Date().toISOString(), lead_id: result.lead.lead_id,
      event_type: result.action === 'create' ? 'lead_created' : 'repeat_inquiry', actor: 'system',
      property_id: result.lead.property_id, details: JSON.stringify({ address: result.lead.property_address, message: result.lead.message, request_type: payload.request_type || 'property' }),
    });
    try { sendLeadAlert_(result); } catch (error) { recordError_('sendLeadAlert', result.lead.lead_id, error, {}); }
    return { ok: true, lead_id: result.lead.lead_id, action: result.action };
  } finally {
    lock.releaseLock();
  }
}

function refreshPropertyLinks() {
  const sheet = getSheet_(SHEETS.properties);
  const webAppUrl = getConfig_('web_app_url');
  if (!webAppUrl) throw new Error('Add the deployed web app URL to Config first.');
  const values = sheet.getDataRange().getValues();
  const headers = values[0];
  const idCol = headers.indexOf('property_id');
  const campaignCol = headers.indexOf('campaign');
  const linkCol = headers.indexOf('form_link');
  for (let row = 1; row < values.length; row += 1) {
    const id = values[row][idCol];
    if (!id) continue;
    const campaign = values[row][campaignCol] || '';
    const url = `${webAppUrl}?property_id=${encodeURIComponent(id)}&source=facebook-organic&campaign=${encodeURIComponent(campaign)}`;
    sheet.getRange(row + 1, linkCol + 1).setValue(url);
  }
}

function sendDailyDigest() {
  const email = getConfig_('alert_email');
  if (!email) return;
  const today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  const leads = rowsAsObjects_(getSheet_(SHEETS.leads)).filter((row) => String(row.created_at).slice(0, 10) === today);
  const tasks = rowsAsObjects_(getSheet_(SHEETS.tasks)).filter((row) => String(row.status).toLowerCase() === 'open');
  const lines = leads.map((lead) => `${lead.full_name} | ${lead.phone || lead.email} | ${lead.property_address}`);
  MailApp.sendEmail(email, `Scardino CRM daily digest: ${leads.length} new leads`, `${lines.join('\n') || 'No new leads today.'}\n\nOpen follow-up tasks: ${tasks.length}`);
}

function createCsvBackup() {
  const folderId = getConfig_('backup_folder_id');
  if (!folderId) return;
  const folder = DriveApp.getFolderById(folderId);
  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
  [SHEETS.leads, SHEETS.properties, SHEETS.tasks, SHEETS.activity, SHEETS.owners].forEach((name) => {
    const rows = getSheet_(name).getDataRange().getDisplayValues();
    const csv = rows.map((row) => row.map(csvCell_).join(',')).join('\n');
    folder.createFile(`${name}-${stamp}.csv`, csv, MimeType.CSV);
  });
}

function importOwnerRows(rows, source) {
  if (!Array.isArray(rows)) throw new Error('Owner import rows must be an array.');
  const sheet = getSheet_(SHEETS.owners);
  rows.forEach((row) => appendObject_(sheet, {
    import_id: Utilities.getUuid(), imported_at: new Date().toISOString(), source_name: source.name || '',
    source_url: source.url || '', tax_year: source.tax_year || '', county: row.county || '', municipality: row.municipality || '',
    block: row.block || '', lot: row.lot || '', qualifier: row.qualifier || '', property_address: row.property_address || '',
    owner_name: row.owner_name || '', owner_mailing_address: row.owner_mailing_address || '', property_class: row.property_class || '',
    assessed_land: row.assessed_land || '', assessed_improvement: row.assessed_improvement || '', assessed_total: row.assessed_total || '',
    record_status: 'imported', source_record_id: row.source_record_id || '', notes: row.notes || '',
  }));
  return rows.length;
}

function getProperty_(propertyId) {
  if (!propertyId) return null;
  return rowsAsObjects_(getSheet_(SHEETS.properties)).find((row) => String(row.property_id) === String(propertyId)) || null;
}

function sendLeadAlert_(result) {
  if (getConfig_('immediate_alerts') !== 'yes') return;
  const email = getConfig_('alert_email');
  if (!email) return;
  const lead = result.lead;
  MailApp.sendEmail(email, `New property lead: ${lead.full_name}`, `${lead.full_name}\n${lead.phone}\n${lead.email}\n${lead.property_address}\n\nStatus: ${result.action}`);
}

function ensureSheet_(ss, name, headers) {
  const sheet = ss.getSheetByName(name) || ss.insertSheet(name);
  const current = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
  if (current.join('|') !== headers.join('|')) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#e5e7eb');
}

function seedConfig_(sheet) {
  if (sheet.getLastRow() > 1) return;
  const rows = [
    ['alert_email', '', 'Lead alert and daily digest destination'],
    ['immediate_alerts', 'no', 'Use yes for one email per lead'],
    ['web_app_url', '', 'Paste the deployed Apps Script web app URL'],
    ['backup_folder_id', '', 'Optional Google Drive folder ID for daily CSV backups'],
    ['timezone', 'America/New_York', 'CRM operating timezone'],
  ];
  sheet.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
}

function installDailyTrigger_(handler, hour) {
  if (ScriptApp.getProjectTriggers().some((trigger) => trigger.getHandlerFunction() === handler)) return;
  ScriptApp.newTrigger(handler).timeBased().everyDays(1).atHour(hour).create();
}

function getConfig_(key) {
  const row = rowsAsObjects_(getSheet_(SHEETS.config)).find((item) => String(item.key) === key);
  return row ? String(row.value || '') : '';
}

function getSheet_(name) {
  const sheet = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sheet) throw new Error(`Missing sheet: ${name}. Run setupCrm first.`);
  return sheet;
}

function rowsAsObjects_(sheet) {
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(String);
  return values.slice(1).filter((row) => row.some((value) => value !== '')).map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index]])));
}

function appendObject_(sheet, object) {
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0].map(String);
  sheet.appendRow(headers.map((header) => safeCell_(object[header])));
}

function updateById_(sheet, key, id, object) {
  const values = sheet.getDataRange().getValues();
  const headers = values[0].map(String);
  const keyCol = headers.indexOf(key);
  const rowIndex = values.findIndex((row, index) => index > 0 && String(row[keyCol]) === String(id));
  if (rowIndex < 1) throw new Error(`Could not find ${key}: ${id}`);
  sheet.getRange(rowIndex + 1, 1, 1, headers.length).setValues([headers.map((header) => safeCell_(object[header]))]);
}

function recordError_(operation, leadId, error, payload) {
  try {
    appendObject_(getSheet_(SHEETS.errors), {
      error_id: Utilities.getUuid(), created_at: new Date().toISOString(), operation, lead_id: leadId,
      message: error && error.message ? error.message : String(error), payload_json: JSON.stringify(payload || {}), resolved: 'no', resolution_notes: '',
    });
  } catch (loggingError) {
    console.error(loggingError);
  }
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function csvCell_(value) {
  const text = String(value == null ? '' : value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function safeCell_(value) {
  if (value == null) return '';
  return typeof value === 'string' && /^[=+@-]/.test(value) ? "'" + value : value;
}

