async function reportApi(request,env){
 const url=new URL(request.url),path=url.pathname.replace(/\/$/,'');
 if(!env.DB)return json({error:'접수 저장소 연결을 확인해 주세요.'},503);
 if(request.method!=='POST')return json({error:'지원하지 않는 요청입니다.'},405);
 if(request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return json({error:'허용되지 않은 요청입니다.'},403);
 let body;try{const text=await request.text();if(text.length>12000)throw Error();body=JSON.parse(text);}catch{return json({error:'입력 내용을 확인해 주세요.'},400);}
 const code=clean(body.code,48);if(!/^[a-f0-9]{48}$/i.test(code))return json({error:'접수 확인번호를 확인해 주세요.'},400);
 const codeHash=await hash(code);
 if(path==='/api/reports/lookup'||path==='/api/reports/withdraw'){
  const report=await env.DB.prepare('SELECT * FROM safety_reports WHERE code_hash=?').bind(codeHash).first();
  if(!report)return json({error:'접수 내역을 찾을 수 없습니다. 확인번호를 확인해 주세요.'},404);
  if(path.endsWith('/withdraw')){await env.DB.prepare('UPDATE safety_reports SET status=\'withdrawn\' WHERE id=?').bind(report.id).run();report.status='withdrawn';}
  return json({report:reportReceipt(report)});
 }
 if(path!=='/api/reports')return json({error:'요청을 찾을 수 없습니다.'},404);
 const title=clean(body.title,120),location=clean(body.location,120),description=clean(body.description,3000),category=clean(body.category,30),name=clean(body.name,60),contact=clean(body.contact,120);
 if(title.length<2||location.length<2||description.length<5||!['시설·설비','소방·전기','미끄럼·낙상','위험요소','기타'].includes(category))return json({error:'신고 유형, 발생 위치, 제목과 신고 내용을 입력해 주세요.'},400);
 if(!/^[0-9a-f-]{36}$/i.test(body.requestId||''))return json({error:'신고 작성을 새로 시작해 주세요.'},400);
 const existing=await env.DB.prepare('SELECT * FROM safety_reports WHERE request_id=?').bind(body.requestId).first();
 if(existing)return existing.code_hash===codeHash?json({report:reportReceipt(existing),code}):json({error:'이미 사용된 접수 요청입니다.'},409);
 const id=crypto.randomUUID(),created_at=new Date().toISOString(),ip_hash=await hash((request.headers.get('CF-Connecting-IP')||'local')+':'+dateToday());
 try{await env.DB.prepare('INSERT INTO safety_reports(id,request_id,category,location,title,description,name,contact,status,code_hash,created_at,ip_hash) VALUES(?,?,?,?,?,?,?,?,\'received\',?,?,?)').bind(id,body.requestId,category,location,title,description,name,contact,codeHash,created_at,ip_hash).run();}catch(e){if(String(e).includes('report_daily_limit'))return json({error:'오늘 접수 요청이 많습니다. 잠시 후 다시 시도해 주세요.'},429);return json({error:'접수를 저장하지 못했습니다. 다시 시도해 주세요.'},503);}
 return json({report:reportReceipt({id,category,location,title,description,name,contact,status:'received',created_at}),code},201);
}
function reportReceipt(r){return {id:r.id,category:r.category,location:r.location,title:r.title,description:r.description,name:r.name,contact:r.contact,status:r.status,createdAt:r.created_at};}
