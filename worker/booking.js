const rooms = [{id:'a',name:'대회의실'},{id:'b',name:'3번 회의실'}];
const json=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(x=>x.toString(16).padStart(2,'0')).join('');
const dateToday=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const clean=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
const validDate=date=>/^\d{4}-\d{2}-\d{2}$/.test(date)&&!Number.isNaN(Date.parse(date))&&new Date(date+'T00:00:00Z').toISOString().slice(0,10)===date;
function validate(body){
  const date=clean(body.date,10), room=clean(body.room,1), start=Number(body.start),end=Number(body.end);
  const name=clean(body.name,60),department=clean(body.department,80),purpose=clean(body.purpose,120),usagePurpose=clean(body.usagePurpose,200);
  if(!rooms.some(r=>r.id===room)||!validDate(date)||date<dateToday()||Date.parse(date)-Date.parse(dateToday())>30*86400000)throw Error('오늘부터 30일 이내의 날짜와 회의실을 선택해 주세요.');
  if(!Number.isInteger(start)||!Number.isInteger(end)||start<540||end>1080||start%30||end%30||end<=start)throw Error('09:00~18:00 사이의 이용 시간을 30분 단위로 선택해 주세요.');
  if(Date.parse(date+'T'+String(Math.floor(start/60)).padStart(2,'0')+':'+String(start%60).padStart(2,'0')+':00+09:00')<=Date.now())throw Error('이미 지난 시간은 예약할 수 없습니다.');
  if(name.length<2||department.length<2||!purpose||!usagePurpose)throw Error('예약자 이름, 소속, 회의명, 사용목적을 입력해 주세요.');
  if(!/^[0-9a-f-]{36}$/i.test(body.requestId||''))throw Error('예약 요청을 새로 시작해 주세요.');
  return {date,room,start,end,name,department,purpose,usagePurpose};
}
export async function api(request,env){
  const url=new URL(request.url),path=url.pathname.replace(/\/$/,'');
  if(!env.DB)return json({error:'예약 저장소 연결을 확인해 주세요.'},503);
  if(request.method!=='GET'&&request.headers.get('Origin')&&request.headers.get('Origin')!==url.origin)return json({error:'허용되지 않은 요청입니다.'},403);
  if(request.method==='GET'&&path==='/api/bookings'){
    const date=url.searchParams.get('date')||dateToday();if(!validDate(date))return json({error:'날짜를 확인해 주세요.'},400);
    const data=await env.DB.prepare('SELECT room,date,start,end,name,department FROM bookings WHERE date=? AND status=\'confirmed\' ORDER BY start').bind(date).all();
    return json({rooms,date,bookings:data.results});
  }
  if(request.method!=='POST')return json({error:'요청을 확인해 주세요.'},405);
  if(Number(request.headers.get('Content-Length'))>4096)return json({error:'입력 내용이 너무 깁니다.'},413);
  let body;try{const text=await request.text();if(text.length>4096)throw Error();body=JSON.parse(text);}catch{return json({error:'입력 내용을 확인해 주세요.'},400);}
  if(path==='/api/bookings'){
    let b;try{b=validate(body);}catch(e){return json({error:e.message},400);}
    if(!/^(?:[0-9]{6}|[0-9a-f]{48})$/i.test(body.code||''))return json({error:'예약 확인번호를 새로 생성해 주세요.'},400);
    const codeHash=await hash(body.code),existing=await env.DB.prepare('SELECT * FROM bookings WHERE request_id=?').bind(body.requestId).first();
    if(existing)return existing.code_hash===codeHash?json({booking:receipt(existing),code:body.code}):json({error:'이미 사용된 요청입니다.'},409);
    const ip=await hash((request.headers.get('CF-Connecting-IP')||'local')+':'+dateToday());
    if(await env.DB.prepare('SELECT id FROM bookings WHERE code_hash=?').bind(codeHash).first())return json({error:'확인번호를 다시 생성합니다.',reason:'code_collision'},409);
    const id=crypto.randomUUID(),now=new Date().toISOString();
    const statements=[env.DB.prepare('INSERT INTO bookings(id,request_id,room,date,start,end,name,department,purpose,code_hash,status,created_at,ip_hash,usage_purpose) VALUES(?,?,?,?,?,?,?,?,?,?,\'confirmed\',?,?,?)').bind(id,body.requestId,b.room,b.date,b.start,b.end,b.name,b.department,b.purpose,codeHash,now,ip,b.usagePurpose)];
    for(let t=b.start;t<b.end;t+=30)statements.push(env.DB.prepare('INSERT INTO booking_slots(room,date,minute,booking_id) VALUES(?,?,?,?)').bind(b.room,b.date,t,id));
    try{await env.DB.batch(statements);}catch(e){if(String(e).includes('code_hash'))return json({error:'확인번호를 다시 생성합니다.',reason:'code_collision'},409);if(String(e).includes('booking_limit'))return json({error:'오늘 예약 요청이 많습니다. 잠시 후 관리 담당자에게 문의해 주세요.'},429);return json({error:'다른 예약이 먼저 등록되었습니다. 시간표를 확인하고 다른 시간을 선택해 주세요.'},409);}
    return json({booking:receipt({...b,id,status:'confirmed',created_at:now}),code:body.code},201);
  }
  if(path==='/api/bookings/lookup'||path==='/api/bookings/cancel'){
    const code=clean(body.code,48);if(!/^(?:[0-9]{6}|[0-9a-f]{48})$/i.test(code))return json({error:'예약 확인번호를 확인해 주세요.'},400);
    const attemptKey=await hash((request.headers.get('CF-Connecting-IP')||'local')+':'+Math.floor(Date.now()/600000));
    const attempts=await env.DB.prepare('SELECT attempts FROM booking_lookup_limits WHERE key=?').bind(attemptKey).first();
    if(attempts?.attempts>=10)return json({error:'확인번호 입력 오류가 반복되었습니다. 10분 후 다시 시도해 주세요.'},429);
    const booking=await env.DB.prepare('SELECT * FROM bookings WHERE code_hash=?').bind(await hash(code)).first();
    if(!booking){await env.DB.batch([env.DB.prepare('DELETE FROM booking_lookup_limits WHERE expires_at<?').bind(Date.now()),env.DB.prepare('INSERT INTO booking_lookup_limits(key,attempts,expires_at) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET attempts=attempts+1').bind(attemptKey,Date.now()+1200000)]);return json({error:'예약을 찾을 수 없습니다. 확인번호를 확인해 주세요.'},404);}
    if(path.endsWith('/cancel'))await env.DB.batch([env.DB.prepare('DELETE FROM booking_slots WHERE booking_id=?').bind(booking.id),env.DB.prepare('UPDATE bookings SET status=\'cancelled\' WHERE id=?').bind(booking.id)]);
    return json({booking:receipt({...booking,...(path.endsWith('/cancel')?{status:'cancelled'}:{})})});
  }
  return json({error:'요청을 찾을 수 없습니다.'},404);
}
function receipt(b){return {id:b.id,room:b.room,roomName:rooms.find(r=>r.id===b.room)?.name,date:b.date,start:b.start,end:b.end,name:b.name,department:b.department,purpose:b.purpose,usagePurpose:b.usage_purpose??b.usagePurpose??'',status:b.status,createdAt:b.created_at};}
