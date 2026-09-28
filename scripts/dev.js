import {createServer} from 'vite';
import leads from '../api/leads.js';
import listings from '../api/idx/listings.js';
import fs from 'node:fs';
// Only load explicitly selected private settings. Never copy them into a build.
if (process.env.GEOGOLD_ENV_FILE) process.loadEnvFile(process.env.GEOGOLD_ENV_FILE);
else if (fs.existsSync('.env.local')) process.loadEnvFile('.env.local');
const server=await createServer({server:{host:'127.0.0.1',port:4173,strictPort:true},plugins:[{name:'local-api',configureServer(server){server.middlewares.use(async(req,res,next)=>{
 const path=(req.url||'').split('?')[0]; const handler=path==='/api/leads'?leads:path==='/api/idx/listings'?listings:null;if(!handler)return next();
 res.status=(code)=>{res.statusCode=code;return res};res.json=(data)=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));return res};
 try {let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>12000){res.status(413).json({ok:false,error:'Request too large.'});return;}}req.body=raw?JSON.parse(raw):{};await handler(req,res);}catch{res.status(500).json({ok:false,error:'The request could not be completed.'});}
 });}}]});await server.listen();server.printUrls();

