import './seller.css';

const dialogs = [...document.querySelectorAll('.seller-dialog')];
const sellerForm = document.querySelector('#seller-contact-form');
const valueForm = document.querySelector('#home-value-form');
let lastTrigger;
let closeTimer;
let lookupController;
function openDialog(id, trigger) {
  const next = document.getElementById(id);
  if (!next || next.open) return;
  dialogs.forEach(dialog => { if (dialog.open) dialog.close(); });
  lastTrigger = trigger;
  if (id === 'sell-contact') {
    clearTimeout(closeTimer);
    sellerForm.reset();
    const address = [valueForm.elements.street.value.trim(), valueForm.elements.city.value.trim(), 'NJ', valueForm.elements.zip.value.trim()].filter(Boolean).join(', ');
    sellerForm.elements.address.value = valueForm.elements.street.value.trim() ? address : '';
    sellerForm.elements.message.value = sellerForm.elements.address.value ? 'Property address: ' + address + '\n' : '';
    if (trigger?.dataset.sellerIntent === 'valuation') sellerForm.elements.message.value = 'I would like a complimentary broker review of my home’s value.\n' + sellerForm.elements.message.value;
    const status = sellerForm.querySelector('.seller-status');
    status.textContent = ''; status.dataset.state = '';
    sellerForm.querySelector('[type=submit]').disabled = false;
  }
  next.showModal();
}
document.querySelectorAll('[data-open-seller]').forEach(button => button.addEventListener('click', () => openDialog(button.dataset.openSeller, button)));
dialogs.forEach(dialog => {
  dialog.querySelector('[data-close-seller]').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', event => {
    const rect = dialog.getBoundingClientRect();
    if (event.target === dialog && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) dialog.close();
  });
  dialog.addEventListener('close', () => { if (dialog.id === 'home-value') lookupController?.abort(); lastTrigger?.focus(); });
});
const preference = sellerForm.elements.contactPreference;
preference.addEventListener('change', () => { sellerForm.elements.phone.required = preference.value === 'phone'; });
sellerForm.addEventListener('reset', () => { sellerForm.elements.phone.required = false; });
sellerForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = sellerForm.querySelector('[type=submit]');
  if (button.disabled) return;
  const status = sellerForm.querySelector('.seller-status');
  button.disabled = true; status.dataset.state = ''; status.textContent = 'Sending your request…';
  try {
    const payload = { ...Object.fromEntries(new FormData(sellerForm)), kind: 'seller-contact' };
    const response = await fetch('/api/leads', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(20000) });
    const result = await response.json();
    if (!response.ok || result.ok !== true || !result.reference) throw new Error('Not confirmed');
    status.dataset.state = 'success'; status.textContent = 'Thank you! Your selling request has been sent to John.';
    closeTimer = setTimeout(() => document.querySelector('#sell-contact').close(), 1800);
  } catch {
    status.dataset.state = 'error'; status.textContent = 'We could not confirm your request. Please call (201) 826-5730 or email geogoldrealty@gmail.com before trying again.';
    button.disabled = false;
  }
});
const money = value => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value);
valueForm.addEventListener('submit', async event => {
  event.preventDefault();
  const button = valueForm.querySelector('[type=submit]');
  if (button.disabled) return;
  const status = document.querySelector('#home-value-status');
  const resultPanel = document.querySelector('#home-value-result');
  resultPanel.hidden = true; button.disabled = true; status.dataset.state = ''; status.textContent = 'Looking up your home…';
  lookupController = new AbortController();
  const timeout = setTimeout(() => lookupController.abort(), 18000);
  try {
    const response = await fetch('/api/valuation', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(new FormData(valueForm))), signal: lookupController.signal });
    const result = await response.json();
    if (!response.ok || !result.valuation) {
      status.dataset.state = 'error'; status.textContent = result.error || 'An online estimate is unavailable for this home. Ask John for a custom CMA below.'; return;
    }
    const value = result.valuation;
    document.querySelector('#value-address').textContent = value.address;
    document.querySelector('#value-facts').textContent = [value.beds ? value.beds + ' beds' : '', value.baths ? value.baths + ' baths' : '', value.squareFeet ? Number(value.squareFeet).toLocaleString() + ' sq ft' : ''].filter(Boolean).join(' · ');
    document.querySelector('#value-amount').textContent = money(value.amount);
    document.querySelector('#value-range').textContent = value.low && value.high ? 'Estimated range: ' + money(value.low) + ' – ' + money(value.high) : '';
    document.querySelector('#value-source').textContent = 'Source: ' + value.source + (value.asOf ? ' · Estimate dated ' + value.asOf : '') + ' · Retrieved ' + new Date(value.retrievedAt).toLocaleDateString();
    resultPanel.hidden = false; status.textContent = 'Your estimate is ready.';
  } catch {
    if (document.querySelector('#home-value').open) { status.dataset.state = 'error'; status.textContent = 'The estimate could not load. Ask John for a custom CMA below, or call (201) 826-5730.'; }
  } finally { clearTimeout(timeout); button.disabled = false; }
});

