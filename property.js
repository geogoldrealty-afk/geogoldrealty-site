const mls = new URLSearchParams(location.search).get('mls');
const root = document.querySelector('#property-detail');
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[character]));
const money = (value) => new Intl.NumberFormat('en-US', {
  style: 'currency', currency: 'USD', maximumFractionDigits: 0
}).format(value || 0);

let listing;
try { listing = JSON.parse(sessionStorage.getItem(`geogold-listing-${mls}`) || 'null'); } catch { listing = null; }

if (!listing) {
  root.innerHTML = '<p>Property details are available from the search results. <a href="/#properties">Return to property search</a>.</p>';
} else {
  const image = /^data:image\/(?:jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(listing.image || '') ? listing.image : '';
  const title = escapeHtml(listing.title);
  document.title = `${listing.title || 'Property'} | Geo Gold Realty`;
  root.innerHTML = `<a href="/#properties">← Back to search</a><section class="property-gallery">${image ? `<img src="${image}" alt="${title}">` : ''}</section><section class="property-meta"><div><p class="eyebrow gold">GSMLS listing</p><h1>${title}</h1><p>${escapeHtml(listing.city)}, NJ ${escapeHtml(listing.postalCode)}</p><h2>${money(listing.price)}${listing.market === 'rent' ? ' / month' : ''}</h2><div class="property-facts"><p><strong>Beds</strong><br>${escapeHtml(listing.beds || '—')}</p><p><strong>Baths</strong><br>${escapeHtml(listing.baths || '—')}</p><p><strong>Property type</strong><br>${escapeHtml(listing.propertyType || '—')}</p><p><strong>MLS number</strong><br>${escapeHtml(listing.mlsNumber)}</p></div></div><aside class="property-panel"><h2>Interested in this home?</h2><p>Contact John for current availability and details.</p><a class="button button-dark" href="/#contact">Ask about this home</a><p>Listed by ${escapeHtml(listing.brokerName || 'GSMLS participating broker')}${listing.brokerContact ? ` · ${escapeHtml(listing.brokerContact)}` : ''}</p>${listing.isIdxListing ? '<p class="idx-badge">IDX Listing</p>' : ''}</aside></section><section class="idx-disclosure"><p>The data displayed relating to real estate for sale comes in part from the IDX Program of Garden State Multiple Listing Service, L.L.C. Real estate listings held by other brokerage firms are marked as IDX Listing.</p><p>Information deemed reliable but not guaranteed.</p></section>`;
}
