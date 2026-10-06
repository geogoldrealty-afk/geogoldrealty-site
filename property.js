const query = new URLSearchParams(location.search);
const mls = query.get('mls');
const root = document.querySelector('#property-detail');
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const money = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value || 0);
const safeImage = (value) => /^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(value || '') ? value : '';
const safeExternalUrl = (value) => { try { const url = new URL(value); return url.protocol === 'https:' ? url.toString() : ''; } catch { return ''; } };

function propertyAddress(listing) { return [listing.title, listing.city, 'NJ', listing.postalCode].filter(Boolean).join(', '); }
function inquiry(listing) { sessionStorage.setItem('geogold-property-inquiry', JSON.stringify({ mlsNumber: listing.mlsNumber, title: listing.title, city: listing.city })); }

function render(listing) {
  const photos = Array.isArray(listing.photos) ? listing.photos.map(safeImage).filter(Boolean) : [];
  const title = escapeHtml(listing.title);
  const address = propertyAddress(listing);
  const directions = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  const tour = safeExternalUrl(listing.virtualTourUrl);
  const facts = [['Beds', listing.beds || '—'], ['Baths', listing.baths || '—'], ['Property type', listing.propertyType || '—'], ['MLS number', listing.mlsNumber], ['Year built', listing.yearBuilt], ['Lot size', listing.lotSize], ['Rooms', listing.rooms], ['Garage', listing.garage]].filter(([, value]) => value);
  document.title = `${listing.title || 'Property'} | Geo Gold Realty`;
  root.innerHTML = `<a class="property-back" href="/#properties">← Back to search</a><section class="property-hero"><div><p class="eyebrow gold">GSMLS listing</p><h1>${title}</h1><p>${escapeHtml(listing.city)}, NJ ${escapeHtml(listing.postalCode)}</p><p class="property-price">${money(listing.price)}${listing.market === 'rent' ? ' / month' : ''}</p></div><div class="property-actions"><a class="button button-dark" href="#property-gallery">View ${photos.length || ''} photo${photos.length === 1 ? '' : 's'}</a><a class="button button-outline" href="${directions}" target="_blank" rel="noopener">Directions</a>${tour ? `<a class="button button-outline" href="${tour}" target="_blank" rel="noopener">Virtual tour</a>` : ''}</div></section><section class="property-gallery" id="property-gallery">${photos.length ? `<img src="${photos[0]}" alt="${title}"><div class="property-thumbnails">${photos.map((image, index) => `<button type="button" data-photo="${index}" aria-label="Show property photo ${index + 1}"><img src="${image}" alt=""></button>`).join('')}</div>` : '<p>Photos are not currently available for this listing.</p>'}</section><section class="property-layout"><div><section class="property-facts"><h2>Property facts</h2><div>${facts.map(([label, value]) => `<p><strong>${escapeHtml(label)}</strong><br>${escapeHtml(value)}</p>`).join('')}</div></section>${listing.description ? `<section class="property-description"><h2>About this property</h2><p>${escapeHtml(listing.description)}</p></section>` : ''}</div><aside class="property-panel"><h2>Interested in this home?</h2><p>Contact John for current availability and details.</p><a class="button button-dark" id="property-inquiry" href="/#contact">Ask about this home</a><p class="property-broker">Listed by ${escapeHtml(listing.brokerName || 'GSMLS participating broker')}${listing.brokerContact ? ` · ${escapeHtml(listing.brokerContact)}` : ''}</p>${listing.isIdxListing ? '<p class="idx-badge">IDX Listing</p>' : ''}</aside></section><section class="idx-disclosure"><p>The data displayed relating to real estate for sale comes in part from the IDX Program of Garden State Multiple Listing Service, L.L.C. Real estate listings held by other brokerage firms are marked as IDX Listing.</p><p>Information deemed reliable but not guaranteed.</p></section>`;
  const primaryImage = root.querySelector('.property-gallery > img');
  root.querySelectorAll('[data-photo]').forEach((button) => button.addEventListener('click', () => { const image = photos[Number(button.dataset.photo)]; if (primaryImage && image) primaryImage.src = image; }));
  root.querySelector('#property-inquiry')?.addEventListener('click', () => inquiry(listing));
}

async function load() {
  if (!/^[0-9]{5,12}$/.test(mls || '')) { root.innerHTML = '<p>Choose a property from the <a href="/#properties">property search</a>.</p>'; return; }
  try {
    const response = await fetch(`/api/idx/detail?mls=${encodeURIComponent(mls)}&market=${encodeURIComponent(query.get('market') || 'buy')}`);
    const data = await response.json();
    if (!response.ok || !data.listing) throw new Error('detail unavailable');
    render(data.listing);
  } catch { root.innerHTML = '<p>Property details are temporarily unavailable. Please return to the <a href="/#properties">property search</a> or contact John for current availability.</p>'; }
}
load();
