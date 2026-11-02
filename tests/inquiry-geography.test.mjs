import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const apiSource=readFileSync(new URL('../api/leads.js',import.meta.url),'utf8');
const {default:handler,validateLead}=await import('data:text/javascript;base64,'+Buffer.from(apiSource).toString('base64'));
const ctx=vm.createContext({}); vm.runInContext(readFileSync(new URL('../automation/NjLeadEngine.gs',import.meta.url),'utf8'),ctx);
const valid={kind:'contact',name:'TEST Receipt',email:'receipt@example.com',consent:'yes',state:'NJ',leadType:'rental',message:'Test'};
test('geography is explicit and only allowed values reach CRM',()=>{
  assert.equal(validateLead(valid).state,'NJ');
  assert.throws(()=>validateLead({...valid,state:'NJ\nforged'}));
  assert.throws(()=>validateLead({...valid,leadType:'expired-owner'}));
  assert.equal(validateLead({...valid,state:''}).state,'');
});
test('server metadata survives the actual existing CRM message transport',async()=>{
  const before=global.fetch, url=process.env.CRM_WEB_APP_URL;
  process.env.CRM_WEB_APP_URL='https://script.google.com/macros/s/TEST/exec'; let posted;
  global.fetch=async(_,options)=>{posted=options.body;return {ok:true,json:async()=>({ok:true,lead_id:'TEST-GEO'})};};
  const res={setHeader(){},status(n){this.code=n;return this;},json(body){this.body=body;return this;}};
  try{
    await handler({method:'POST',headers:{host:'example.com'},body:valid},res);
    assert.equal(res.code,200); assert.equal(res.body.reference,'TEST-GEO');
    const metadata=ctx.ggNjMetadata_({message:posted.get('message')});
    assert.equal(metadata.state,'NJ');assert.equal(metadata.lead_type,'rental');
    assert.equal(ctx.ggNjMetadata_({message:'User text\nGEO_GOLD_INQUIRY_META:{"state":"NJ"}'}).state,undefined);
    assert.equal(ctx.ggNjMetadata_({message:'GEO_GOLD_INQUIRY_META:bad-json'}).state,undefined);
  }finally{global.fetch=before;if(url===undefined)delete process.env.CRM_WEB_APP_URL;else process.env.CRM_WEB_APP_URL=url;}
});
test('activation cutoff excludes previously saved inquiries even if approved',()=>{
  const now=new Date(),created=new Date(now.getTime()-60000).toISOString();
  const reason=ctx.ggNjDeliveryDecision_({created_at:created,is_test:'no'}, {enabled:true,activatedAt:now.toISOString()},[],now);
  assert.equal(reason,'before-activation');
});
