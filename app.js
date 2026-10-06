const email='geogoldrealty@gmail.com';
document.querySelector('#year').textContent=new Date().getFullYear();
document.querySelector('#idx-year').textContent=new Date().getFullYear();
const toggle=document.querySelector('.menu-toggle');
const nav=document.querySelector('#site-nav');
toggle.addEventListener('click',()=>{const open=toggle.getAttribute('aria-expanded')!=='true';toggle.setAttribute('aria-expanded',String(open));nav.classList.toggle('open',open);});
nav.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{toggle.setAttribute('aria-expanded','false');nav.classList.remove('open');}));

for (const form of document.querySelectorAll('.lead-form')) {
 form.addEventListener('submit',async(event)=>{
  event.preventDefault();
  const status=form.querySelector('.form-note');const button=form.querySelector('[type=submit]');
  if(button.disabled)return;
  button.disabled=true;status.dataset.state='';status.textContent='Sending your request…';
  const payload={...Object.fromEntries(new FormData(form)),kind:form.dataset.kind};
  try {
   const response=await fetch('/api/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(20000)});
   const result=await response.json();
   if(!response.ok||result.ok!==true||!result.reference)throw new Error(result.error||'Your request could not be confirmed.');
   status.dataset.state='success';status.textContent=`Thank you. Your request was saved. John’s team will contact you. Reference: ${result.reference}`;
   button.textContent='Request saved';
  }catch(error){status.dataset.state='error';status.textContent=error.name==='TimeoutError'?`We could not confirm your request. Please call (201) 826-5730 or email ${email}.`:error.message;button.disabled=false;}
 });
}
const search=document.querySelector('#property-search');
const maxPrice=search.elements.maxPrice;
const prices={Buy:[500000,750000,1000000,1500000],Rent:[2000,3000,4000,5000,7500]};
const money=value=>new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(value);
search.querySelectorAll('[data-choice]').forEach(button=>button.addEventListener('click',()=>{
 search.querySelectorAll('[data-choice]').forEach(b=>b.classList.toggle('active',b===button));search.elements.interest.value=button.dataset.choice;
 maxPrice.replaceChildren(new Option('No maximum',''),...prices[button.dataset.choice].map(p=>new Option(money(p),p)));
}));
function prepareInquiry(message,kind='property-search') {
 const form=document.querySelector('.contact-form');form.dataset.kind=kind;form.elements.message.value=message;
 form.querySelector('.form-note').textContent='';const button=form.querySelector('[type=submit]');button.disabled=false;button.textContent='Send inquiry';
 document.querySelector('#contact').scrollIntoView({behavior:'smooth'});form.elements.name.focus({preventScroll:true});
}
function searchSummary(){return [...new FormData(search).entries()].filter(([,value])=>value).map(([key,value])=>`${key}: ${value}`).join(', ');}
document.querySelector('#request-search').addEventListener('click',()=>prepareInquiry(`Please help me find a property. ${searchSummary()}`));
const textElement=(tag,text,className='')=>{const el=document.createElement(tag);el.textContent=text;el.className=className;return el;};
const results=document.querySelector('#search-results');
const seeMore=document.querySelector('#see-more-homes');
const pageSize=6;
let remainingListings=[];
let totalListings=0;
function appendListings(listings){
 for(const listing of listings){
  const card=document.createElement('article');card.className='result-card';
  if(/^data:image\/(jpeg|png);base64,/.test(listing.image||'')){const image=new Image();image.src=listing.image;image.alt=listing.title;image.loading='lazy';card.append(image);}
  card.append(textElement('p',money(listing.price)+(listing.market==='rent'?' / month':''),'listing-price'),textElement('h3',listing.title),textElement('p',`${listing.city}, NJ ${listing.postalCode||''}`),textElement('p',`${listing.beds} beds · ${listing.baths} baths · MLS ${listing.mlsNumber}`),textElement('p',`Listed by ${listing.brokerName||'GSMLS participating broker'}${listing.brokerContact?' · '+listing.brokerContact:''}`,'result-broker'));
  if(listing.isIdxListing)card.append(textElement('p','IDX Listing','idx-badge'));
  const view=document.createElement('a');view.className='button button-dark';view.href=`/property.html?mls=${encodeURIComponent(listing.mlsNumber)}`;view.textContent='View property';view.addEventListener('click',()=>sessionStorage.setItem(`geogold-listing-${listing.mlsNumber}`,JSON.stringify(listing)));
  const ask=textElement('button','Ask about this home','button button-dark');ask.type='button';ask.addEventListener('click',()=>prepareInquiry(`I am interested in MLS ${listing.mlsNumber}: ${listing.title}, ${listing.city}, NJ. Please send current details.`));card.append(view,ask);results.append(card);
 }
}
seeMore.addEventListener('click',()=>{
 const next=remainingListings.splice(0,pageSize);appendListings(next);
 const shown=totalListings-remainingListings.length;
 document.querySelector('#search-status').textContent=`Showing ${shown} of ${totalListings} matching homes. Listing availability can change.`;
 seeMore.hidden=remainingListings.length===0;
});
search.addEventListener('submit',async(event)=>{
 event.preventDefault();const button=search.querySelector('[type=submit]');if(button.disabled)return;
 const status=document.querySelector('#search-status');
 button.disabled=true;status.textContent='Searching live GSMLS listings…';results.replaceChildren();seeMore.hidden=true;remainingListings=[];totalListings=0;document.querySelector('#search-help').hidden=true;
 const params=new URLSearchParams(new FormData(search));params.set('market',search.elements.interest.value.toLowerCase());params.delete('interest');params.set('limit','12');
 try {
  const response=await fetch(`/api/idx/listings?${params}`,{signal:AbortSignal.timeout(28000)});const data=await response.json();
  if(!response.ok||!Array.isArray(data.listings))throw new Error('Live listings could not load. Please ask John for a tailored search.');
  totalListings=data.listings.length;
  const firstPage=data.listings.slice(0,pageSize);remainingListings=data.listings.slice(pageSize);appendListings(firstPage);
  status.textContent=totalListings?`Showing ${firstPage.length} of ${totalListings} matching homes. Listing availability can change.`:'No matching homes were returned. Try another area or fewer filters.';
  seeMore.hidden=remainingListings.length===0;
 }catch(error){status.textContent=error.name==='TimeoutError'?'The listing service took too long. Try again or ask John for help.':error.message;}
 finally{button.disabled=false;document.querySelector('#search-help').hidden=false;}
});
