const fallback='https://kt-haengdang-building.tao23t.chatgpt.site';
export default async function handler(req,res){
const route=String(req.query?.path||'').replace(/\/$/,'');
if(!/^(bookings(?:\/(?:lookup|cancel))?|reports(?:\/(?:lookup|withdraw))?)$/.test(route)){res.status(404).json({error:'요청을 찾을 수 없습니다.'});return;}
if(!['GET','POST'].includes(req.method)){res.status(405).json({error:'허용되지 않은 요청입니다.'});return;}
const origin=new URL(process.env.BOOKING_API_ORIGIN||fallback);const upstream=new URL('/api/'+route,origin);const incoming=new URL(req.url,'https://local');for(const [key,value] of incoming.searchParams)if(key!=='path')upstream.searchParams.append(key,value);
try{const headers={'Content-Type':'application/json',Origin:origin.origin};const body=req.method==='POST'?(typeof req.body==='string'?req.body:JSON.stringify(req.body||{})):undefined;if(body&&body.length>(route.startsWith('reports')?12000:4096)){res.status(413).json({error:'입력 내용이 너무 깁니다.'});return;}const response=await fetch(upstream,{method:req.method,headers,body,signal:AbortSignal.timeout(15000),redirect:'error'});res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json; charset=utf-8');res.status(response.status).send(await response.text());}catch{res.status(502).json({error:'데이터 서버 연결을 확인해 주세요.'});}
}
