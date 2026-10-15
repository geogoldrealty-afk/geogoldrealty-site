const query = new URLSearchParams(location.search);
const mls = query.get('mls');
const root = document.querySelector('#property-detail');
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
const safeImage = (value) => /^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(value || '') ? value : '';
const safeExternalUrl = (value) => { try { const url = new URL(value); return url.protocol === 'https:' ? url.toString() : ''; } catch { return ''; } };

function propertyAddress(listing) { return [listing.title, listing.city, 'NJ', listing.postalCode].filter(Boolean).join(', '); }

function renderInquiryModal(listing) {
  const address = propertyAddress(listing);
  return `<div class="property-modal" id="property-inquiry-modal" hidden>
    <div class="property-modal__backdrop" data-modal-close></div>
    <section class="property-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="property-modal-title" tabindex="-1">
      <button class="property-modal__close" type="button" data-modal-close aria-label="Close contact form">×</button>
      <h2 id="property-modal-title">Contact Agent</h2>
      <img class="property-modal__logo" src="/assets/geo-gold-logo-B4MOCR03.png" alt="Geo Gold Realty Group LLC">
      <p class="property-modal__license">NJ License #1223971</p>
      <p class="property-modal__property">Ask about <strong>${escapeHtml(listing.title)}</strong><br>MLS #${escapeHtml(listing.mlsNumber)}</p>
      <form class="property-modal__form" id="property-inquiry-form">
        <label>Email*<input name="email" type="email" required autocomplete="email" maxlength="254"></label>
        <div class="property-modal__names">
          <label>First name*<input name="first_name" required autocomplete="given-name" maxlength="60"></label>
          <label>Last name*<input name="last_name" required autocomplete="family-name" maxlength="60"></label>
        </div>
        <label>Phone*<input name="phone" type="tel" required autocomplete="tel" maxlength="25"></label>
        <label>Message*<textarea name="message" required rows="5" maxlength="3000" placeholder="I would like more information about this home."></textarea></label>
        <label class="property-modal__consent"><input type="checkbox" name="consent" value="yes" required> By providing Geo Gold Realty your contact information, you acknowledge and agree to our privacy policy and consent to receiving marketing communications. You can opt out at any time.</label>
        <label class="property-modal__honeypot" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
        <button class="button button-dark" type="submit">Send</button>
        <p class="property-modal__status" role="status" aria-live="polite"></p>
      </form>
    </section>
  </div>`;
}

function attachInquiryModal(listing) {
  const modal = root.querySelector('#property-inquiry-modal');
  const openButton = root.querySelector('#property-inquiry');
  const dialog = modal?.querySelector('.property-modal__dialog');
  const form = modal?.querySelector('#property-inquiry-form');
  let priorFocus;
  let closeTimer;
  const status = modal?.querySelector('.property-modal__status');

  const close = () => {
    if (!modal || modal.hidden) return;
    if (closeTimer) window.clearTimeout(closeTimer);
    closeTimer = undefined;
    modal.hidden = true;
    document.body.classList.remove('property-modal-open');
    openButton?.focus();
  };
  const open = () => {
    if (!modal) return;
    priorFocus = document.activeElement;
    form?.reset();
    if (status) status.textContent = '';
    modal.hidden = false;
    document.body.classList.add('property-modal-open');
    dialog?.focus();
  };

  openButton?.addEventListener('click', (event) => { event.preventDefault(); open(); });
  modal?.querySelectorAll('[data-modal-close]').forEach((button) => button.addEventListener('click', close));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !modal?.hidden) close();
  });

  form?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const submit = form.querySelector('button[type="submit"]');
    const fields = new FormData(form);
    const name = [fields.get('first_name'), fields.get('last_name')].map((value) => String(value || '').trim()).filter(Boolean).join(' ');
    const payload = {
      kind: 'property-search',
      name,
      email: String(fields.get('email') || ''),
      phone: String(fields.get('phone') || ''),
      address: propertyAddress(listing),
      need: `Property inquiry — MLS #${listing.mlsNumber}: ${listing.title}`,
      message: String(fields.get('message') || ''),
      consent: fields.get('consent') ? 'yes' : '',
      website: String(fields.get('website') || ''),
    };

    submit.disabled = true;
    status.textContent = 'Sending your inquiry…';
    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const result = await response.json();
      if (!response.ok || !result.ok || !result.reference) throw new Error('Lead was not saved.');
      form.reset();
      status.textContent = 'Thank you — your inquiry was sent.';
      closeTimer = window.setTimeout(close, 1400);
    } catch {
      status.textContent = 'We could not confirm your request. Please call John at (201) 826-5730 or email geogoldrealty@gmail.com.';
    } finally {
      submit.disabled = false;
    }
  });
}

function render(listing) {
  const photos = Array.isArray(listing.photos) ? listing.photos.map(safeImage).filter(Boolean) : [];
  const title = escapeHtml(listing.title);
  const address = propertyAddress(listing);
  const directions = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  const tour = safeExternalUrl(listing.virtualTourUrl);
  const fallbackFacts = [['Beds', listing.beds || '—'], ['Baths', listing.baths || '—'], ['Property type', listing.propertyType || '—'], ['MLS number', listing.mlsNumber], ['Year built', listing.yearBuilt], ['Lot size', listing.lotSize], ['Rooms', listing.rooms], ['Garage', listing.garage]].filter(([, value]) => value);
  const factGroups = Array.isArray(listing.facts) ? listing.facts.filter((group) => group && typeof group.title === 'string' && Array.isArray(group.entries) && group.entries.length) : [];
  const factsMarkup = factGroups.length ? factGroups.map((group) => `<section class="property-fact-group"><h3>${escapeHtml(group.title)}</h3><div>${group.entries.map(([label, value]) => `<p><strong>${escapeHtml(label)}</strong><br>${escapeHtml(value)}</p>`).join('')}</div></section>`).join('') : `<div class="property-fact-group"><div>${fallbackFacts.map(([label, value]) => `<p><strong>${escapeHtml(label)}</strong><br>${escapeHtml(value)}</p>`).join('')}</div></div>`;
  document.title = `${listing.title || 'Property'} | Geo Gold Realty`;
  root.innerHTML = `<a class="property-back" href="/property-search.html?market=${encodeURIComponent(listing.market || 'buy')}">← Back to search</a><section class="property-hero"><div><p class="eyebrow gold">GSMLS listing</p><h1>${title}</h1><p>${escapeHtml(listing.city)}, NJ ${escapeHtml(listing.postalCode)}</p><p class="property-price">${money(listing.price)}${listing.market === 'rent' ? ' / month' : ''}</p></div><div class="property-actions"><a class="button button-dark" href="#property-gallery">View ${photos.length || ''} photo${photos.length === 1 ? '' : 's'}</a><a class="button button-outline" href="${directions}" target="_blank" rel="noopener">Directions</a>${tour ? `<a class="button button-outline" href="${tour}" target="_blank" rel="noopener">Virtual tour</a>` : ''}</div></section><section class="property-gallery" id="property-gallery">${photos.length ? `<img src="${photos[0]}" alt="${title}"><div class="property-thumbnails">${photos.map((image, index) => `<button type="button" data-photo="${index}" aria-label="Show property photo ${index + 1}"><img src="${image}" alt=""></button>`).join('')}</div>` : '<p>Photos are not currently available for this listing.</p>'}</section><section class="property-layout"><div><section class="property-facts"><h2>Property facts</h2>${factsMarkup}</section>${listing.description ? `<section class="property-description"><h2>About this property</h2><p>${escapeHtml(listing.description)}</p></section>` : ''}</div><aside class="property-panel"><h2>Interested in this home?</h2><p>Contact John for current availability and details.</p><button class="button button-dark" id="property-inquiry" type="button">Ask about this home</button>${listing.isIdxListing ? '<p class="idx-badge">IDX Listing</p>' : ''}</aside></section><section class="idx-disclosure"><p>The data displayed relating to real estate for sale comes in part from the IDX Program of Garden State Multiple Listing Service, L.L.C. Real estate listings held by other brokerage firms are marked as IDX Listing.</p><p>Information deemed reliable but not guaranteed.</p></section>${renderInquiryModal(listing)}`;
  const primaryImage = root.querySelector('.property-gallery > img');
  root.querySelectorAll('[data-photo]').forEach((button) => button.addEventListener('click', () => { const image = photos[Number(button.dataset.photo)]; if (primaryImage && image) primaryImage.src = image; }));
  attachInquiryModal(listing);
}

async function load() {
  if (!/^[0-9]{5,12}$/.test(mls || '')) { root.innerHTML = '<p>Choose a property from the <a href="/property-search.html?market=buy">property search</a>.</p>'; return; }
  try {
    const response = await fetch(`/api/idx/detail?mls=${encodeURIComponent(mls)}&market=${encodeURIComponent(query.get('market') || 'buy')}`);
    const data = await response.json();
    if (!response.ok || !data.listing) throw new Error('detail unavailable');
    render(data.listing);
  } catch { root.innerHTML = '<p>Property details are temporarily unavailable. Please return to the <a href="/property-search.html?market=buy">property search</a> or contact John for current availability.</p>'; }
}
load();
