const email='geogoldrealty@gmail.com';
document.querySelector('#year').textContent=new Date().getFullYear();
const idxYear=document.querySelector('#idx-year');if(idxYear)idxYear.textContent=new Date().getFullYear();
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
   form.reset();
   button.disabled=false;
  }catch(error){status.dataset.state='error';status.textContent=error.name==='TimeoutError'?`We could not confirm your request. Please call (201) 826-5730 or email ${email}.`:error.message;button.disabled=false;}
 });
}
