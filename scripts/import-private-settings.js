import fs from 'node:fs';
import path from 'node:path';
import {parseEnv} from 'node:util';
const input=process.argv[2];
if(!input)throw new Error('Give the local path to PRIVATE-SETTINGS.env.');
const values=parseEnv(fs.readFileSync(path.resolve(input),'utf8'));
const keys=['GSMLS_RETS_LOGIN_URL','GSMLS_RETS_USERNAME','GSMLS_RETS_PASSWORD','GSMLS_RETS_USER_AGENT','GSMLS_RETS_USER_AGENT_PASSWORD','CRM_WEB_APP_URL'];
if(keys.slice(0,5).some(k=>!values[k]))throw new Error('The private file is missing a required MLS setting. Values were not printed.');
const target=path.resolve('.env.local');
if(fs.existsSync(target))throw new Error('.env.local already exists. Compare the existing settings before replacing it.');
fs.writeFileSync(target,keys.map(k=>`${k}=${JSON.stringify(values[k]||'')}`).join('\n')+'\n',{mode:0o600});
console.log('Private server settings written to ignored .env.local. Account passwords were excluded.');

