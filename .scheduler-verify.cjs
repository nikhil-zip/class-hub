const base='http://localhost:3000';
function client(){let cookie='';return async(url,opt={})=>{const h={...(opt.headers||{})};if(cookie)h.Cookie=cookie;const r=await fetch(base+url,{...opt,headers:h});const c=r.headers.get('set-cookie');if(c)cookie=c.split(';')[0];const j=await r.json();if(!r.ok)throw Error(JSON.stringify(j));return j}}
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const teacher=client(); await teacher('/api/auth/teacher',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'admin',password:'admin123'})});
 const students=[];for(const name of ['FIFO A','FIFO B','FIFO C','FIFO D']){const c=client();await c('/api/auth/student',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studentId:name.replaceAll(' ','-'),name})});students.push(c)}
 const a=await students[0]('/api/student/session/request',{method:'POST'});const b=await students[1]('/api/student/session/request',{method:'POST'});const c=await students[2]('/api/student/session/request',{method:'POST'});const d=await students[3]('/api/student/session/request',{method:'POST'});
 console.log('CAPACITY/QUEUE',a.session.state,b.session.state,c.session.state,c.session.position,d.session.position);
 await wait(6500);
 const aStatus=await students[0]('/api/student/session');const cStatus=await students[2]('/api/student/session');const dStatus=await students[3]('/api/student/session');
 console.log('EXPIRY/COOLDOWN/PROMOTION',aStatus.session.state,aStatus.session.remaining,cStatus.session.state,dStatus.session.state,'FIFO',cStatus.session.startedAt<=dStatus.session.startedAt);
 if(a.session.state!=='active'||b.session.state!=='active'||c.session.state!=='waiting'||c.session.position!==1||d.session.position!==2||aStatus.session.state!=='cooldown'||cStatus.session.state!=='active'||dStatus.session.state!=='active'||cStatus.session.startedAt>dStatus.session.startedAt)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1});
