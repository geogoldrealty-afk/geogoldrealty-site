import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../automation/NjLeadEngine.gs', import.meta.url),'utf8');
function engine(overrides={}) { const ctx=vm.createContext(overrides); vm.runInContext(source,ctx); return ctx; }
const now = new Date('2026-11-01T15:00:00Z');
function inquiry(ctx, overrides={}) {
  const lead={lead_id:'TEST-1',created_at:now.toISOString(),name:'Test Buyer',email:'buyer@example.com',state:'NJ',source:'geogold-website',consent:'yes',status:'pending-review',lead_type:'buyer',delivery_status:'not-sent',is_test:'no',...overrides};
  const draft=ctx.ggNjDraft_(lead); return {...lead,subject:draft.subject,draft:draft.body};
}
test('all 21 NJ counties covered; missing geography never inferred',()=> {
  const ctx=engine(); assert.equal(ctx.GG_NJ.counties.length,21);
  assert.equal(ctx.ggNjDeliveryDecision_(inquiry(ctx,{state:''}),{enabled:true,autoReply:true},[],now),'state-needs-review');
});
test('rotation uses oldest eligible assignment and only this week activity',()=> {
  const ctx=engine(); const base={name:'Agent',email:'agent@example.com',active:'yes',week_start:'2026-10-26',weekly_soi_contacts:5};
  const agents=[{...base,agent_id:'A',last_assigned_at:'2026-11-01'},{...base,agent_id:'B',last_assigned_at:''}];
  assert.equal(ctx.ggNjAgent_(agents,now),'B');
  agents[1].week_start='2026-10-19'; assert.equal(ctx.ggNjAgent_(agents,now),'A');
  agents[0].active='no'; assert.equal(ctx.ggNjAgent_(agents,now),'B');
  agents[1].active='no'; assert.equal(ctx.ggNjAgent_(agents,now),'BROKER-REVIEW');
});
test('single-agent setup seeds Geo Scardino once and assigns without a weekly activity gate',()=> {
  const f=fakeCrm(); f.ctx.ggNjSetup(); f.ctx.ggNjSetup();
  const agents=f.ctx.ggNjRows_('NJ Agents');
  assert.equal(agents.length,1); assert.equal(agents[0].name,'Geo Scardino');
  assert.equal(agents[0].email,'geogoldrealty@gmail.com');
  assert.equal(f.ctx.ggNjAgent_(agents,now),'GEO-SCARDINO');
  agents[0].active='no'; assert.equal(f.ctx.ggNjAgent_(agents,now),'BROKER-REVIEW');
});
test('source, consent, suppression, stale records and test data prevent sending',()=> {
  const ctx=engine(), config={enabled:true,autoReply:true};
  for(const [field,value,reason] of [['consent','no','missing-consent'],['source','gsmls','source-needs-review'],['is_test','yes','test-record'],['created_at','2026-09-01','stale-inquiry'],['lead_type','tour','existing-tour-receipt']]) {
    assert.equal(ctx.ggNjDeliveryDecision_(inquiry(ctx,{[field]:value}),config,[],now),reason);
  }
  assert.equal(ctx.ggNjDeliveryDecision_(inquiry(ctx),config,['buyer@example.com'],now),'suppressed');
  assert.equal(ctx.ggNjDeliveryDecision_(inquiry(ctx),{},[],now),'delivery-disabled');
});
test('automatic receipts use fixed copy; edited messages require recorded approval',()=> {
  const ctx=engine(), config={enabled:true,autoReply:true}, lead=inquiry(ctx);
  assert.equal(ctx.ggNjDeliveryDecision_(lead,config,[],now),'send');
  lead.draft='Edited draft'; assert.equal(ctx.ggNjDeliveryDecision_(lead,config,[],now),'needs-approval');
  lead.status='approved'; assert.equal(ctx.ggNjDeliveryDecision_(lead,config,[],now),'needs-approval');
  lead.approved_by='John'; assert.equal(ctx.ggNjDeliveryDecision_(lead,config,[],now),'send');
});
test('a sent or uncertain delivery cannot be sent twice',()=> {
  const ctx=engine(), config={enabled:true,autoReply:true};
  for(const delivery_status of ['sending','sent','unknown']) assert.equal(ctx.ggNjDeliveryDecision_(inquiry(ctx,{delivery_status}),config,[],now),'already-attempted');
});
test('templates offer CMA without invented program terms or appointment promises',()=> {
  const ctx=engine(); assert.match(ctx.ggNjDraft_({lead_type:'seller'}).body,/comparative market analysis/);
  assert.doesNotMatch(ctx.ggNjDraft_({lead_type:'seller'}).body,/commission|guarantee|Smart Listing Program/i);
  assert.match(ctx.ggNjDraft_({lead_type:'tour'}).body,/confirm availability/);
});
test('spreadsheet formula injection is neutralized',()=> {
  const ctx=engine(); assert.equal(ctx.ggNjCell_('=IMPORTXML("x")'),'\'=IMPORTXML("x")');
  assert.equal(ctx.ggNjCell_(5),5);
});

function fakeCrm() {
  const tables = { Leads: [['lead_id','created_at','full_name','email','phone','source','consent','campaign','state','county']] };
  const sheet = name => ({
    getDataRange:()=>({getValues:()=>tables[name].map(r=>[...r])}),
    appendRow:row=>tables[name].push([...row]), getLastRow:()=>tables[name].length,
    getLastColumn:()=>tables[name][0]?.length || 0,
    getRange:(row,col,height,width)=>({
      getValues:()=>tables[name].slice(row-1,row-1+height).map(r=>r.slice(col-1,col-1+width)),
      setValues:values=>values.forEach((r,i)=>{tables[name][row-1+i]=[...r];}),
      setBackground(){return this;},setFontColor(){return this;},setFontWeight(){return this;}
    }), setFrozenRows(){}
  });
  const ss={getSheetByName:name=>tables[name]?sheet(name):null,insertSheet:name=>{tables[name]=[];return sheet(name);}};
  const sent=[]; let enabled='no',throwSend=false;
  const ctx=engine({SpreadsheetApp:{getActive:()=>ss,flush(){}},LockService:{getScriptLock:()=>({tryLock:()=>true,releaseLock(){}})},
    PropertiesService:{getScriptProperties:()=>({getProperty:key=>key==='NJ_LEAD_DELIVERY_ENABLED'?enabled:'no'})},
    MailApp:{getRemainingDailyQuota:()=>50,sendEmail:message=>{sent.push(message);if(throwSend)throw Error('synthetic delivery uncertainty');}}
  });
  return {ctx,tables,sent,enable(){enabled='yes';},fail(){throwSend=true;}};
}

test('operator test sends only to the fixed mailbox once, stays marked as test and changes no settings',()=> {
  const f=fakeCrm(); f.ctx.ggNjSetup();
  vm.runInContext(readFileSync(new URL('../automation/NjOperatorTest.gs',import.meta.url),'utf8'),f.ctx);
  assert.equal(f.ctx.ggNjSendOperatorTest(),'sent');
  assert.equal(f.ctx.ggNjSendOperatorTest(),'sent');
  assert.equal(f.sent.length,1); assert.equal(f.sent[0].to,'geogoldrealty@gmail.com');
  const record=f.ctx.ggNjRows_('NJ Lead Board')[0];
  assert.equal(record.is_test,'yes'); assert.equal(record.follow_up_status,'completed');
  assert.equal(record.status,'test-completed'); assert.equal(record.assigned_agent,'GEO-SCARDINO');
  f.ctx.ggNjSendApproved(); assert.equal(f.sent.length,1);
});

test('setup preserves old CRM; sync is repeatable and routes both agents fairly',()=> {
  const f=fakeCrm(); f.ctx.ggNjSetup(); const before=JSON.stringify(f.tables.Leads[0]);
  const week=f.ctx.ggNjWeek_(new Date());
  f.tables['NJ Agents'][1]=['AGENT-1','A','a@example.com','yes',week,5,''];
  f.tables['NJ Agents'][2]=['AGENT-2','B','b@example.com','yes',week,5,''];
  for(let i=1;i<=2;i++)f.tables.Leads.push(['L'+i,new Date().toISOString(),'Buyer '+i,'b'+i+'@example.com','','geogold-website','yes','seller-contact','NJ','Bergen']);
  f.ctx.ggNjSync(); f.ctx.ggNjSync();
  assert.equal(f.tables['NJ Lead Board'].length,3);
  const records=f.ctx.ggNjRows_('NJ Lead Board');
  assert.equal(records[0].assigned_agent,'AGENT-1'); assert.equal(records[1].assigned_agent,'AGENT-2');
  assert.equal(JSON.stringify(f.tables.Leads[0]),before);
});

test('delivery persists attempt, sends once and excludes test records',()=> {
  const f=fakeCrm(); f.ctx.ggNjSetup(); const lead=inquiry(f.ctx,{created_at:new Date().toISOString(),status:'approved',approved_by:'John'});
  f.ctx.ggNjAppend_('NJ Lead Board',lead); f.ctx.ggNjSendApproved(); assert.equal(f.sent.length,0);
  f.enable(); f.ctx.ggNjSendApproved(); f.ctx.ggNjSendApproved(); assert.equal(f.sent.length,1);
  assert.equal(f.ctx.ggNjRows_('NJ Lead Board')[0].delivery_status,'sent');
});

test('uncertain delivery is logged and never retried automatically',()=> {
  const f=fakeCrm(); f.ctx.ggNjSetup(); f.enable(); f.fail();
  f.ctx.ggNjAppend_('NJ Lead Board',inquiry(f.ctx,{created_at:new Date().toISOString(),status:'approved',approved_by:'John'}));
  f.ctx.ggNjSendApproved(); f.ctx.ggNjSendApproved(); assert.equal(f.sent.length,1);
  assert.equal(f.ctx.ggNjRows_('NJ Lead Board')[0].delivery_status,'unknown');
  assert.ok(!JSON.stringify(f.tables['NJ Automation Log']).includes('buyer@example.com'));
});

test('setup refuses a different schema without overwriting it',()=> {
  const f=fakeCrm(); f.tables['NJ Agents']=[['Existing unrelated columns']];
  assert.throws(()=>f.ctx.ggNjSetup(),/Existing columns differ/);
  assert.deepEqual(f.tables['NJ Agents'],[['Existing unrelated columns']]);
});
