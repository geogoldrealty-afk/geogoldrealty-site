const kinds = new Set(['valuation', 'contact', 'property-search']);
const clean = (value) => typeof value === 'string' ? value.trim() : '';

export function validateLead(input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Invalid request.');
  const data = Object.fromEntries(['kind','name','email','phone','address','message','need','website','consent'].map(k => [k, clean(input[k])]));
  if (!kinds.has(data.kind)) throw new Error('Choose a valid request type.');
  if (data.website) throw new Error('This request could not be accepted.');
  if (!data.name || data.name.length > 120) throw new Error('Enter your name.');
  if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) throw new Error('Enter a valid email address.');
  if (data.phone && !/^\+?[\d\s().-]{7,25}$/.test(data.phone)) throw new Error('Enter a valid phone number.');
  if (!data.email && !data.phone) throw new Error('Enter an email address or phone number.');
  if (data.kind === 'valuation' && !data.address) throw new Error('Enter the property address.');
  if (data.consent !== 'yes') throw new Error('Please agree to be contacted about this request.');
  if (data.message.length > 3000 || data.address.length > 300 || data.email.length > 254) throw new Error('Your request is too long.');
  return data;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {res.setHeader('Allow','POST');return res.status(405).json({ok:false,error:'Method not allowed.'});}
  const origin = req.headers.origin;
  if (origin && origin !== `https://${req.headers.host}` && !(process.env.NODE_ENV !== 'production' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin) && origin === `http://${req.headers.host}`)) return res.status(403).json({ok:false,error:'Invalid request origin.'});
  let lead;
  try {lead=validateLead(typeof req.body === 'string' ? JSON.parse(req.body) : req.body);} catch(e) {return res.status(400).json({ok:false,error:e.message});}
  const target=process.env.CRM_WEB_APP_URL;
  if (!target || !/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/.test(target)) return res.status(503).json({ok:false,error:'Online requests are not available yet. Please call John at (201) 826-5730 or email geogoldrealty@gmail.com.'});
  const [first_name,...rest]=lead.name.split(/\s+/);
  try {
    const response=await fetch(target,{method:'POST',body:new URLSearchParams({first_name,last_name:rest.join(' '),email:lead.email,phone:lead.phone,consent:lead.consent,website:lead.website,request_type:lead.kind,property_address:lead.address,source:'geogold-website',campaign:lead.kind,message:[lead.need,lead.message].filter(Boolean).join('\n')}),signal:AbortSignal.timeout(15000)});
    const result=await response.json();
    if (!response.ok || result.ok !== true || !result.lead_id) throw new Error('CRM did not confirm a saved lead.');
    return res.status(200).json({ok:true,reference:result.lead_id});
  } catch {return res.status(502).json({ok:false,error:'We could not confirm that your request was saved. Please call John or email geogoldrealty@gmail.com before trying again.'});}
}

