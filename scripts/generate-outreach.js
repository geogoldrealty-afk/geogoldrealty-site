import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value = ''] = arg.replace(/^--/, '').split('=');
    return [key, value];
  }),
);
const inputPath = path.resolve(root, args.get('input') || 'crm/sample-contacts.csv');
const outputPath = path.resolve(root, args.get('output') || 'crm/daily-outreach-generated.csv');
const batchSize = Number(args.get('limit') || 10);
if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) throw new Error('Use a batch size from 1 to 100.');
const today = new Date().toISOString().slice(0, 10);

function parseCsvLine(line) {
  const values = [];
  let current = '';
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ',' && !quoted) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function escapeCsv(value) {
  const normalized = String(value ?? '');

  if (/[",\n]/.test(normalized)) {
    return `"${normalized.replaceAll('"', '""')}"`;
  }

  return normalized;
}

function phoneForLink(phone) {
  const digits = String(phone ?? '').replace(/[^\d]/g, '');
  return digits.length === 10 ? '1' + digits : digits;
}

function firstName(row) {
  return row.first_name || String(row.full_name || '').split(/\s+/)[0] || 'there';
}

function draftMessage(row) {
  const name = firstName(row);
  const need = row.need_type && row.need_type !== 'Referral unknown' ? row.need_type.toLowerCase() : 'real estate';

  if (String(row.relationship || '').toLowerCase().includes('contractor')) {
    return `Hey ${name}, it's John Scardino. Quick check-in. Are you seeing any homeowners, investors, or builders who need help buying, selling, flipping, or figuring out a property this month?`;
  }

  if (String(row.relationship || '').toLowerCase().includes('attorney')) {
    return `Hey ${name}, it's John Scardino. Quick check-in. If any clients need practical real estate help with a sale, purchase, property issue, or investor conversation, I'm taking those calls now.`;
  }

  if (['buying', 'selling', 'flipping', 'building'].includes(need)) {
    return `Hey ${name}, it's John Scardino. Quick check-in. Are you still thinking about ${need}, or do you know anyone who needs practical real estate help this year?`;
  }

  return `Hey ${name}, it's John Scardino. Quick check-in. Do you or someone close to you need help with ${need}, buying, selling, flipping, or making sense of a property this year?`;
}

function followUpMessage(row) {
  const name = firstName(row);
  return `Hey ${name}, just putting this back on your radar. If anyone close to you is thinking about buying, selling, flipping, or dealing with a property question, send them my way and I'll take care of them.`;
}

function nextFollowUpDate(offsetDays = 3) {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

function readContacts() {
  const text = fs.readFileSync(inputPath, 'utf8').trim();
  const [headerLine, ...lines] = text.split(/\r?\n/);
  const headers = parseCsvLine(headerLine);

  return lines
    .map((line) => {
      const values = parseCsvLine(line);
      return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? '']));
    })
    .filter((row) => !['yes', 'true', '1'].includes(String(row.opt_out || '').trim().toLowerCase()));
}

const contacts = readContacts()
  .filter((row) => !['sent', 'do not contact', 'not interested', 'closed'].includes(String(row.status).trim().toLowerCase()))
  .slice(0, batchSize);
const headers = [
  'queue_date',
  'sequence_number',
  'contact_id',
  'full_name',
  'channel',
  'phone',
  'email',
  'relationship',
  'need_angle',
  'message_draft',
  'follow_up_draft',
  'wa_me_link',
  'sms_link',
  'status',
  'sent_by',
  'reply_summary',
  'next_action',
  'next_follow_up_date',
];

const rows = contacts.map((row, index) => {
  const message = draftMessage(row);
  const followUp = followUpMessage(row);
  const phone = phoneForLink(row.primary_phone);
  const link = phone ? `https://web.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(message)}` : '';
  const smsLink = phone ? `sms:${phone}?&body=${encodeURIComponent(message)}` : '';

  return {
    queue_date: today,
    sequence_number: index + 1,
    contact_id: row.contact_id,
    full_name: row.full_name,
    channel: phone ? 'WhatsApp' : 'Email',
    phone: row.primary_phone,
    email: row.primary_email,
    relationship: row.relationship,
    need_angle: row.need_type || 'Referral check',
    message_draft: message,
    follow_up_draft: followUp,
    wa_me_link: link,
    sms_link: smsLink,
    status: 'queued',
    sent_by: row.owner || 'John',
    reply_summary: '',
    next_action: 'Send first warm check-in',
    next_follow_up_date: nextFollowUpDate(),
  };
});

const csv = [headers.join(','), ...rows.map((row) => headers.map((header) => escapeCsv(row[header])).join(','))].join('\n');
fs.writeFileSync(outputPath, `${csv}\n`);
console.log(`Generated ${rows.length} outreach rows at ${outputPath}`);

