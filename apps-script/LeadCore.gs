var LeadCore = (() => {
  const clean = (value) => String(value == null ? '' : value).trim();

  function normalizeEmail(value) {
    return clean(value).toLowerCase();
  }

  function normalizePhone(value) {
    const digits = clean(value).replace(/\D/g, '');
    if (digits.length === 10) return `1${digits}`;
    return digits;
  }

  function requireLead(payload, property) {
    if (!property || clean(property.status).toLowerCase() !== 'active') {
      throw new Error('This property link is not active.');
    }
    if (clean(payload.website)) throw new Error('This submission could not be accepted.');
    if (!clean(payload.first_name)) throw new Error('First name is required.');
    if (!normalizeEmail(payload.email) && !normalizePhone(payload.phone)) {
      throw new Error('An email or phone number is required.');
    }
    if (clean(payload.consent).toLowerCase() !== 'yes') throw new Error('Consent is required.');
  }

  function propertyAddress(property) {
    return [property.address, property.municipality, property.county, property.state]
      .map(clean)
      .filter(Boolean)
      .join(', ');
  }

  function makeId(prefix, now) {
    const stamp = now.toISOString().replace(/\D/g, '').slice(0, 14);
    return `${prefix}-${stamp}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
  }

  function findDuplicate(existingLeads, email, phone) {
    return existingLeads.find((lead) => (
      (email && normalizeEmail(lead.normalized_email) === email)
      || (phone && normalizePhone(lead.normalized_phone) === phone)
    ));
  }

  function prepareSubmission(payload, property, existingLeads, now = new Date()) {
    requireLead(payload, property);
    const email = normalizeEmail(payload.email);
    const phone = normalizePhone(payload.phone);
    const duplicate = findDuplicate(existingLeads || [], email, phone);
    const leadId = duplicate ? duplicate.lead_id : makeId('LEAD', now);
    const submissionCount = Number(duplicate && duplicate.submission_count) || 1;

    const lead = {
      lead_id: leadId,
      created_at: duplicate && duplicate.created_at ? duplicate.created_at : now.toISOString(),
      updated_at: now.toISOString(),
      first_name: clean(payload.first_name),
      last_name: clean(payload.last_name),
      full_name: [payload.first_name, payload.last_name].map(clean).filter(Boolean).join(' '),
      email: clean(payload.email),
      phone,
      normalized_email: email,
      normalized_phone: phone,
      property_id: clean(property.property_id),
      property_address: propertyAddress(property),
      source: clean(payload.source) || 'facebook-organic',
      campaign: clean(payload.campaign),
      message: clean(payload.message),
      consent: 'yes',
      consent_at: now.toISOString(),
      status: duplicate && duplicate.status ? duplicate.status : 'new',
      owner: duplicate && duplicate.owner ? duplicate.owner : 'John',
      submission_count: duplicate ? submissionCount + 1 : 1,
      last_touch_at: duplicate && duplicate.last_touch_at ? duplicate.last_touch_at : '',
      next_follow_up_at: now.toISOString(),
      notes: duplicate ? [duplicate.notes, 'Repeat inquiry. Review prior activity.'].filter(Boolean).join('\n') : '',
    };

    const task = {
      task_id: makeId('TASK', now),
      lead_id: leadId,
      created_at: now.toISOString(),
      due_at: now.toISOString(),
      owner: lead.owner,
      priority: 'high',
      status: 'open',
      next_action: payload.request_type === 'valuation' ? 'Review property and contact valuation lead' : payload.source === 'geogold-website' ? 'Contact new website lead' : 'Contact new Facebook property lead',
      property_id: lead.property_id,
      notes: duplicate ? 'Repeat inquiry. Review the existing lead before contact.' : '',
    };

    return { action: duplicate ? 'update' : 'create', lead, task };
  }

  return { normalizeEmail, normalizePhone, prepareSubmission, propertyAddress };
})();

