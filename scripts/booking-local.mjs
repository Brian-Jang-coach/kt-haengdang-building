import http from 'node:http';
import {DatabaseSync} from 'node:sqlite';
import fs from 'node:fs';
import worker from '../dist/server/index.js';
fs.mkdirSync('.sites-runtime',{recursive:true});
const db=new DatabaseSync('.sites-runtime/booking-qa.sqlite');db.exec('PRAGMA foreign_keys=ON');
if(!db.prepare("SELECT name FROM sqlite_master WHERE name='bookings'").get())db.exec(fs.readFileSync('drizzle/0000_room_bookings.sql','utf8'));
if(!db.prepare('PRAGMA table_info(bookings)').all().some(c=>c.name==='usage_purpose'))db.exec(fs.readFileSync('drizzle/0001_usage_purpose.sql','utf8'));
if(!db.prepare("SELECT name FROM sqlite_master WHERE name='safety_reports'").get())db.exec(fs.readFileSync('drizzle/0002_safety_reports.sql','utf8'));
if(!db.prepare("SELECT name FROM sqlite_master WHERE name='booking_lookup_limits'").get())db.exec(fs.readFileSync('drizzle/0003_booking_lookup_limits.sql','utf8'));
function prepare(sql){let values=[];return {bind(...v){values=v;return this;},async all(){return {results:db.prepare(sql).all(...values)};},async first(){return db.prepare(sql).get(...values)||null;},run(){return db.prepare(sql).run(...values);}};}
const env={DB:{prepare,async batch(statements){db.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>s.run());db.exec('COMMIT');return results;}catch(e){db.exec('ROLLBACK');throw e;}}}};
http.createServer(async(req,res)=>{try{const chunks=[];for await(const c of req)chunks.push(c);const request=new Request('http://127.0.0.1:3002'+req.url,{method:req.method,headers:req.headers,...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(chunks)}:{})});const r=await worker.fetch(request,env);res.writeHead(r.status,Object.fromEntries(r.headers));res.end(Buffer.from(await r.arrayBuffer()));}catch{res.writeHead(500);res.end('Local server error');}}).listen(3002,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:3002'));
