const fs = require('node:fs');
const base = 'http://localhost:3000';
function client() {
  let cookie = '';
  return async (url, options = {}) => {
    const headers = { ...(options.headers || {}) };
    if (cookie) headers.Cookie = cookie;
    const response = await fetch(base + url, { ...options, headers, redirect: 'manual' });
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) cookie = setCookie.split(';')[0];
    const contentType = response.headers.get('content-type') || '';
    const body = contentType.includes('application/json') ? await response.json() : await response.text();
    if (!response.ok) throw new Error(`${options.method || 'GET'} ${url}: ${response.status} ${JSON.stringify(body)}`);
    return body;
  };
}
async function main() {
  const t = client();
  const landing = await t('/'); console.log('LANDING', landing.includes('Offline-first digital hub'));
  const status = await t('/api/status'); console.log('STATUS', status.online, status.addresses.join(','), status.config.maxActiveSessions);
  await t('/api/auth/teacher', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({username:'admin',password:'admin123'}) });
  let d = await t('/api/teacher/dashboard'); console.log('TEACHER LOGIN/DASHBOARD', d.stats);
  await t('/api/teacher/announcements', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({title:'Verify notice',content:'Local classroom update'}) });
  d = await t('/api/teacher/dashboard'); const announcement = d.announcements.find(x=>x.title==='Verify notice');
  const studentClients = [];
  for (let i=1;i<=3;i++) { const c=client(); await c('/api/auth/student',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({studentId:`VERIFY${i}`,name:`Verify Student ${i}`})}); studentClients.push(c); }
  let sd=await studentClients[0]('/api/student/dashboard'); console.log('STUDENT JOIN/DASHBOARD',sd.student.name,sd.announcements.some(x=>x.id===announcement.id));
  await t(`/api/teacher/announcements/${announcement.id}`,{method:'DELETE'});
  const filepath='uploads/classhub-verification.pdf'; fs.writeFileSync(filepath, Buffer.from('%PDF-1.4\nClassHub verification file\n%%EOF'));
  const form=new FormData(); form.append('title','Verify PDF'); form.append('file',new Blob([fs.readFileSync(filepath)],{type:'application/pdf'}),'verify.pdf');
  await t('/api/teacher/materials',{method:'POST',body:form});
  d=await t('/api/teacher/dashboard'); const material=d.materials.find(x=>x.title==='Verify PDF');
  sd=await studentClients[0]('/api/student/dashboard'); const search=await studentClients[0]('/api/student/materials?q=verify');
  console.log('ANNOUNCEMENT/MATERIAL',!d.announcements.some(x=>x.id===announcement.id),Boolean(material),sd.materials.some(x=>x.id===material.id),'search',search.materials.some(x=>x.id===material.id));
  await t(`/api/teacher/materials/${material.id}`,{method:'DELETE'}); fs.rmSync(filepath,{force:true});
  console.log('MATERIAL DELETE',!(await t('/api/teacher/dashboard')).materials.some(x=>x.id===material.id));
  console.log('SESSION REQUEST',(await studentClients[0]('/api/student/session/request',{method:'POST'})).session);
  await t('/api/teacher/simulate',{method:'POST'}); d=await t('/api/teacher/dashboard');
  console.log('SCHEDULER CAPACITY',d.stats.active,d.config.maxActiveSessions,'QUEUE',d.stats.queue,'SIMULATED',d.stats.simulatedStudents);
  await t('/api/teacher/simulate/clear',{method:'POST'});
  console.log('CLEARED SIMULATION', (await t('/api/teacher/dashboard')).stats.simulatedStudents);
}
main().catch(e=>{console.error(e);process.exitCode=1});
