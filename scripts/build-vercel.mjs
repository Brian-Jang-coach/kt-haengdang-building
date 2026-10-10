import fs from 'node:fs';
import path from 'node:path';
import './build-booking.mjs';
const {default:worker}=await import('../dist/server/index.js');
const base=process.env.SITE_URL||(process.env.VERCEL_PROJECT_PRODUCTION_URL?'https://'+process.env.VERCEL_PROJECT_PRODUCTION_URL:'https://kt-haengdang-building.tao23t.chatgpt.site');
const files=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())walk(p);else files.push(path.relative('site-assets',p).split(path.sep).join('/'));}}walk('site-assets');files.push('report-client.js','reservation-client.js','booking.css');
for(const file of new Set(files)){const response=await worker.fetch(new Request('https://export.local/'+(file.endsWith('index.html')?file.slice(0,-10):file)),{});if(!response.ok)throw Error('Cannot export '+file);let bytes=Buffer.from(await response.arrayBuffer());if(file.endsWith('.html'))bytes=Buffer.from(bytes.toString().replaceAll('https://kt-haengdang-building.tao23t.chatgpt.site/images/',base.replace(/\/$/,'')+'/images/'));const dest=path.join('public',file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes);}
console.log('Vercel static export ready.');
