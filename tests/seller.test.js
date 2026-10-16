import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { validateLead } from '../api/leads.js';
import valuationHandler, { validateAddress, publicValuation } from '../api/valuation.js';
const input = { kind:'seller-contact', name:'TEST Seller', email:'seller@example.com', phone:'', contactPreference:'email', message:'TEST ONLY: selling inquiry', consent:'yes' };
const response = () => ({ headers:{}, setHeader(k,v){this.headers[k]=v;}, status(n){this.code=n;return this;}, json(body){this.body=body;return this;} });
test('Seller requires valid consent, email, message and chosen contact channel', () => {
  assert.equal(validateLead(input).contactPreference,'email');
  for (const change of [{consent:''},{email:''},{message:''},{contactPreference:'other'},{contactPreference:'phone'}]) assert.throws(()=>validateLead({...input,...change}));
  assert.equal(validateLead({...input,contactPreference:'phone',phone:'2015550123'}).phone,'2015550123');
});
test('Seller transport preserves details and existing CRM email-alert route', async () => {
  const priorFetch=global.fetch, priorUrl=process.env.CRM_WEB_APP_URL;
  process.env.CRM_WEB_APP_URL='https://script.google.com/macros/s/TEST_ONLY/exec';
  let posted;
  global.fetch=async (url, options)=>{posted=options.body;return {ok:true,json:async()=>({ok:true,lead_id:'TEST-SELLER-REFERENCE'})};};
  try {
    const res=response(); await handler({method:'POST',headers:{host:'preview.example.com',origin:'https://preview.example.com'},body:input},res);
    assert.equal(res.code,200); assert.equal(res.body.reference,'TEST-SELLER-REFERENCE');
    assert.equal(posted.get('request_type'),'property-search'); assert.equal(posted.get('campaign'),'seller-contact');
    assert.match(posted.get('message'),/SELLER INQUIRY — Preferred contact: email/); assert.match(posted.get('message'),/TEST ONLY/);
    global.fetch=async()=>({ok:true,json:async()=>({ok:true})});
    const failed=response();await handler({method:'POST',headers:{host:'preview.example.com'},body:input},failed);assert.equal(failed.code,502);assert.equal(failed.body.ok,false);
  } finally {global.fetch=priorFetch;if(priorUrl===undefined)delete process.env.CRM_WEB_APP_URL;else process.env.CRM_WEB_APP_URL=priorUrl;}
});
const requested={street:'123 Test St',city:'Lyndhurst',zip:'07071'};
const fixture={property:[{address:{line1:'123 Test St',line2:'Lyndhurst NJ 07071',countrySubd:'NJ',postal1:'07071',matchCode:'ExaStr'},avm:{amount:{value:650000,low:600000,high:700000},eventDate:'2026-10-01'},building:{rooms:{beds:3,bathsTotal:2},size:{livingsize:1600}},owner:{name:'PRIVATE_MARKER'}}]};
test('Valuation validates NJ address and only exposes permitted display fields',()=>{
  assert.deepEqual(validateAddress(requested),requested);
  assert.throws(()=>validateAddress({...requested,zip:'10001'}));
  const result=publicValuation(fixture,requested);assert.equal(result.amount,650000);assert.equal(result.low,600000);assert.equal(result.source,'ATTOM');assert.ok(!JSON.stringify(result).includes('PRIVATE_MARKER'));
  assert.equal(publicValuation(fixture,{...requested,zip:'07101'}),null);
  assert.equal(publicValuation({property:[{...fixture.property[0],address:{...fixture.property[0].address,matchCode:'Approx'}}]},requested),null);
  assert.equal(publicValuation({property:[]},requested),null);
});
test('Unconfigured valuation never makes a provider call or returns a fabricated amount',async()=>{
  const prior=process.env.VALUATION_ENABLED, priorFetch=global.fetch;delete process.env.VALUATION_ENABLED;
  global.fetch=async()=>{throw new Error('must not call provider');};
  try {const res=response();await valuationHandler({method:'POST',headers:{host:'preview.example.com'},body:requested},res);assert.equal(res.code,503);assert.equal(res.body.valuation,undefined);assert.match(res.body.error,/custom CMA/);}finally{global.fetch=priorFetch;if(prior===undefined)delete process.env.VALUATION_ENABLED;else process.env.VALUATION_ENABLED=prior;}
});
