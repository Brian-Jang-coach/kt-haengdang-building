import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
const assetVersion=createHash('sha256').update(fs.readFileSync('worker/reservation-client.js')).update(fs.readFileSync('worker/booking.css')).update(fs.readFileSync('site-assets/style.css')).update(fs.readFileSync('worker/report-client.js')).digest('hex').slice(0,12);
const root=process.cwd(),out=path.join(root,'dist');
// Sites metadata is optional for Vercel's static export. The generated
// Worker still uses the DB binding when run with the local D1 adapter.
const hostingPath=path.join(root,'.openai','hosting.json');
const hosting=fs.existsSync(hostingPath)
  ? JSON.parse(fs.readFileSync(hostingPath,'utf8'))
  : {d1:'DB',r2:null};
if(hosting.static||hosting.d1!=='DB')throw Error('Worker must use the DB binding');
const assets={};
const mime={'.png':'image/png','.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.js':'text/javascript; charset=utf-8','.jpg':'image/jpeg','.txt':'text/plain; charset=utf-8'};
function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else{let key='/'+path.relative('site-assets',f).split(path.sep).join('/');if(key.endsWith('/index.html'))key=key.slice(0,-11)||'/';let bytes=fs.readFileSync(f);if(e.name.endsWith('.html')){let s=bytes.toString().replace(/<(?:div|aside) class="public-preview-banner">[\s\S]*?<\/(?:div|aside)>/,'<div class="public-preview-banner">회의실 예약과 안전 개선 요청을 로그인 없이 이용할 수 있습니다. 확인번호로 접수 내역을 조회하세요.</div>');if(key==='/reservations'||key==='/reservations/my'){s=s.replace('</head>','<link rel="stylesheet" href="/booking.css"></head>').replace('</body>','<script src="/reservation-client.js" defer></script></body>');}bytes=Buffer.from(s);}assets[key]={type:mime[path.extname(f)]||'application/octet-stream',data:bytes.toString('base64')};}}}
walk('site-assets');
for(const [key,asset] of Object.entries(assets)){
 if(asset.type.startsWith('text/html')){
  let html=Buffer.from(asset.data,'base64').toString().replace(/<div class="development-note">[\s\S]*?<\/div>/g,'<div class="development-note">회의실 예약과 안전 개선 요청은 실제 서버에 저장됩니다. 로그인 기능은 연결 준비 중입니다.</div>');
  html=html.replace('</head>','<meta property="og:type" content="website"><meta property="og:title" content="KT 행당빌딩 | 사옥·안전관리"><meta property="og:description" content="안전은 든든하게, 사옥 이용은 간편하게"><meta property="og:image" content="https://kt-haengdang-building.tao23t.chatgpt.site/images/building-premium-v3.jpg"><meta property="og:image:alt" content="KT 행당빌딩 저녁 분위기 연출 이미지"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="https://kt-haengdang-building.tao23t.chatgpt.site/images/building-premium-v3.jpg"></head>');
  if(key==='/support'||key==='/support/my')html=html.replace('</head>','<link rel="stylesheet" href="/booking.css"></head>').replace('</body>',`<script src="/report-client.js?v=${assetVersion}" defer></script></body>`);
  asset.data=Buffer.from(html.replace('src="/reservation-client.js"',`src="/reservation-client.js?v=${assetVersion}"`).replace('href="/booking.css"',`href="/booking.css?v=${assetVersion}"`).replace('href="/style.css"',`href="/style.css?v=${assetVersion}"`)).toString('base64');
 }
}
for(const [name,type] of [['report-client.js',mime['.js']],['reservation-client.js',mime['.js']],['booking.css',mime['.css']]])assets['/'+name]={type,data:fs.readFileSync('worker/'+name).toString('base64')};
const booking=fs.readFileSync('worker/booking.js','utf8').replace('export async function api','async function api');
const reportServer=fs.readFileSync('worker/reports.js','utf8');
const entry=`${booking}\n${reportServer}\nconst assets=${JSON.stringify(assets)};\nexport default {async fetch(request,env){try{const url=new URL(request.url);if(url.pathname.startsWith('/api/reports'))return await reportApi(request,env);if(url.pathname.startsWith('/api/'))return await api(request,env);let key=url.pathname.replace(/\\/$/,'')||'/';const asset=assets[key];if(!asset)return new Response('페이지를 찾을 수 없습니다.',{status:404});if(!['GET','HEAD'].includes(request.method))return new Response('Method not allowed',{status:405});const bytes=Uint8Array.from(atob(asset.data),c=>c.charCodeAt(0));return new Response(request.method==='HEAD'?null:bytes,{headers:{'Content-Type':asset.type,'Cache-Control':asset.type.startsWith('text/html')?'no-store':'public, max-age=300','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'}});}catch{return json({error:'서버 연결을 확인해 주세요. 잠시 후 다시 시도해 주세요.'},500);}}};\n`;
fs.mkdirSync(path.join(out,'server'),{recursive:true});fs.mkdirSync(path.join(out,'.openai'),{recursive:true});
fs.writeFileSync(path.join(out,'server/index.js'),entry);fs.writeFileSync(path.join(out,'.openai/hosting.json'),JSON.stringify(hosting,null,2));
console.log('Built booking Worker and '+Object.keys(assets).length+' assets');
