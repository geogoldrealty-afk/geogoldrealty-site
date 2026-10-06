const query = new URLSearchParams(location.search);
const mls = query.get('mls');
const root = document.querySelector('#property-detail');
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));
const money = (value) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0
}).format(value || 0);
const safeImage = (value) => /^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(value || '') ? value : '';

function render(listing) {
  const photos = Array.isArray(listing.photos) ? listing.photos.map(safeImage).filter(Boolean) : [];
  const title = escapeHtml(listing.title);
  document.title = `${listing.title || 'Property'} | Geo Gold Realty`;
  root.innerHTML = `<a href="/#properties">← Back to search</a><section class="property-gallery">${photos.length ? `<img src="${photos[0]}" alt="${title}"><div class="property-thumbnails">${photos.slice(1).map((image, index) => `<button type="button" data-photo="${index + 1}" aria-label="Show property photo ${index + 2}"><img src="${image}" alt=""></button>`).join('')}</div>` : '<p>Photos are not currently available for this listing.</p>'}</section><section class="property-meta"><div><p class="eyebrow gold">GSMLS listing</p><h1>${title}</h1><p>${escapeHtml(listing.city)}, NJ ${escapeHtml(listing.postalCode)}</p><h2>${money(listing.price)}${listing.market === 'rent' ? ' / month' : ''}</h2><div class="property-facts"><p><strong>Beds</strong><br>${escapeHtml(listing.beds || '—')}</p><p><strong>Baths</strong><br>${escapeHtml(listing.baths || '—')}</p><p><strong>Property type</strong><br>${escapeHtml(listing.propertyType || '—')}</p><p><strong>MLS number</strong><br>${escapeHtml(listing.mlsNumber)}</p>${listing.yearBuilt ? `<p><strong>Year built</strong><br>${escapeHtml(listing.yearBuilt)}</p>` : ''}${listing.lotSize ? `<p><strong>Lot size</strong><br>${escapeHtml(listing.lotSize)}</p>` : ''}</div>${listing.description ? `<section class="property-description"><h2>About this property</h2><p>${escapeHtml(listing.description)}</p></section>` : ''}</div><aside class="property-panel"><h2>Interested in this home?</h2><p>Contact John for current availability and details.</p><a class="button button-dark" href="/#contact">Ask about this home</a><p>Listed by ${escapeHtml(listing.brokerName || 'GSMLS participating broker')}${listing.brokerContact ? ` · ${escapeHtml(listing.brokerContact)}` : ''}</p>${listing.isIdxListing ? '<p class="idx-badge">IDX Listing</p>' : ''}</aside></section><section class="idx-disclosure"><p>The data displayed relating to real estate for sale comes in part from the IDX Program of Garden State Multiple Listing Service, L.L.C. Real estate listings held by other brokerage firms are marked as IDX Listing.</p><p>Information deemed reliable but not guaranteed.</p></section>`;
  const primaryImage = root.querySelector('.property-gallery > img');
  root.querySelectorAll('[data-photo]').forEach((button) => button.addEventListener('click', () => {
    const image = photos[Number(button.dataset.photo)];
    if (primaryImage && image) primaryImage.src = image;
  }));
}

async function load() {
  if (!/^[0-9]{5,12}$/.test(mls || '')) {
    root.innerHTML = '<p>Choose a property from the <a href="/#properties">property search</a>.</p>';
    return;
  }
  try {
    const response = await fetch(`/api/idx/detail?mls=${encodeURIComponent(mls)}&market=${encodeURIComponent(query.get('market') || 'buy')}`);
    const data = await response.json();
    if (!response.ok || !data.listing) throw new Error('detail unavailable');
    render(data.listing);
  } catch {
    root.innerHTML = '<p>Property details are temporarily unavailable. Please return to the <a href="/#properties">property search</a> or contact John for current availability.</p>';
  }
}

load();
