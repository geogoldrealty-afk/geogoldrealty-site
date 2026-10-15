const form=document.querySelector('#listing-search');
const results=document.querySelector('#search-results');
const status=document.querySelector('#search-status');
const seeMore=document.querySelector('#see-more-homes');
const tabs=[...document.querySelectorAll('[data-market]')];
const mapElement=document.querySelector('#listing-map');
const mapMessage=document.querySelector('#map-message');
const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value||0);
let market=new URLSearchParams(location.search).get('market')==='rent'?'rent':'buy';
let listings=[];
let shown=0;
let map;
let markerLayer;
const pageSize=9;
const defaultMapCenter=[40.75,-74.16];
const defaultMapZoom=8;
function escapeHtml(value){return String(value||'').replace(/[&<>"']/g,character=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));}
function setMarket(next){market=next;tabs.forEach(button=>{const selected=button.dataset.market===market;button.classList.toggle('active',selected);button.classList.toggle('button-outline',!selected);});}
function initMap(){
 if(!mapElement)return;
 if(!window.L){mapMessage.textContent='The map could not load. You can still search the listings.';return;}
 map=window.L.map(mapElement,{scrollWheelZoom:false}).setView(defaultMapCenter,defaultMapZoom);
 window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'© OpenStreetMap contributors'}).addTo(map);
 markerLayer=window.L.layerGroup().addTo(map);
}
function mappableListings(){return listings.filter(listing=>Number.isFinite(Number(listing.latitude))&&Number.isFinite(Number(listing.longitude)));}
function selectListing(listing){
 document.querySelectorAll('.search-card.is-selected').forEach(card=>card.classList.remove('is-selected'));
 const card=document.querySelector('[data-listing-id="'+CSS.escape(String(listing.mlsNumber))+'"]');
 if(card){card.classList.add('is-selected');card.scrollIntoView({block:'nearest',behavior:'smooth'});}
}
function renderMap(){
 if(!map||!markerLayer)return;
 markerLayer.clearLayers();
 const mapped=mappableListings();
 if(!mapped.length){map.setView(defaultMapCenter,defaultMapZoom);mapMessage.textContent=listings.length?'The MLS did not provide map coordinates for these homes.':'Search to see matching homes on the map.';return;}
 const bounds=[];
 mapped.forEach(listing=>{
   const position=[Number(listing.latitude),Number(listing.longitude)];
   bounds.push(position);
   const label=escapeHtml(money(listing.price)+(listing.market==='rent'?'/mo':''));
   const marker=window.L.marker(position,{icon:window.L.divIcon({className:'',html:'<span class="map-pin">'+label+'</span>',iconSize:null})});
   const detail='/property.html?mls='+encodeURIComponent(listing.mlsNumber)+'&market='+encodeURIComponent(listing.market||market);
   marker.bindPopup('<strong>'+escapeHtml(listing.title)+'</strong><br>'+label+'<br><a href="'+detail+'">View property</a>');
   marker.on('click',()=>selectListing(listing));
   marker.addTo(markerLayer);
 });
 if(bounds.length===1)map.setView(bounds[0],14);else map.fitBounds(bounds,{padding:[36,36],maxZoom:14});
 mapMessage.textContent='Select a price pin to highlight its matching home.';
}
function card(listing){
 const article=document.createElement('article');article.className='search-card';article.dataset.listingId=listing.mlsNumber;
 if(/^data:image\/(jpeg|png);base64,/.test(listing.image||'')){const image=new Image();image.src=listing.image;image.alt=listing.title;image.loading='lazy';article.append(image);}
 const price=document.createElement('p');price.className='search-price';price.textContent=money(listing.price)+(listing.market==='rent'?' / month':'');
 const title=document.createElement('h2');title.textContent=listing.title;
 const location=document.createElement('p');location.textContent=[listing.city,'NJ',listing.postalCode].filter(Boolean).join(', ');
 const facts=document.createElement('p');facts.textContent=`${listing.beds} beds · ${listing.baths} baths · MLS ${listing.mlsNumber}`;
 const broker=document.createElement('p');broker.textContent=`Listed by ${listing.brokerName||'GSMLS participating broker'}`;
 const actions=document.createElement('div');actions.className='result-actions';
 const view=document.createElement('a');view.className='button button-dark';view.href=`/property.html?mls=${encodeURIComponent(listing.mlsNumber)}&market=${encodeURIComponent(listing.market||market)}`;view.textContent='View property';
 actions.append(view);article.append(price,title,location,facts,broker,actions);
 article.addEventListener('mouseenter',()=>selectListing(listing));
 return article;
}
function showNext(){const next=listings.slice(shown,shown+pageSize);next.forEach(item=>results.append(card(item)));shown+=next.length;status.textContent=listings.length?`Showing ${shown} of ${listings.length} matching homes. Listing availability can change.`:'No matching homes were returned. Try another area or fewer filters.';seeMore.hidden=shown>=listings.length;}
tabs.forEach(button=>button.addEventListener('click',()=>{setMarket(button.dataset.market);form.requestSubmit();}));
seeMore.addEventListener('click',showNext);
form.addEventListener('submit',async(event)=>{event.preventDefault();const button=form.querySelector('[type=submit]');if(button.disabled)return;button.disabled=true;results.replaceChildren();seeMore.hidden=true;status.textContent='Searching live GSMLS listings…';const params=new URLSearchParams(new FormData(form));params.set('market',market);params.set('limit','24');try{const response=await fetch(`/api/idx/listings?${params}`,{signal:AbortSignal.timeout(28000)});const data=await response.json();if(!response.ok||!Array.isArray(data.listings))throw new Error('Live listings could not load. Please contact John for a tailored search.');listings=[...data.listings];const sort=form.elements.sort.value;if(sort==='priceDesc')listings.sort((a,b)=>b.price-a.price);if(sort==='priceAsc')listings.sort((a,b)=>a.price-b.price);shown=0;renderMap();showNext();}catch(error){status.textContent=error.name==='TimeoutError'?'The listing service took too long. Please try again.':error.message;mapMessage.textContent='The map will update when a search returns matching homes.';}finally{button.disabled=false;}});
setMarket(market);
initMap();
