require('dotenv').config();
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const { DatabaseSync } = require('node:sqlite');
const multer = require('multer');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createScheduler } = require('./services/accessScheduler');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction) {
  for (const key of ['ADMIN_USERNAME', 'ADMIN_PASSWORD', 'SESSION_SECRET', 'DATABASE_PATH', 'UPLOAD_DIR']) {
    if (!process.env[key]) throw new Error(`${key} must be configured when NODE_ENV=production`);
  }
  if (!path.isAbsolute(process.env.DATABASE_PATH) || !path.isAbsolute(process.env.UPLOAD_DIR)) {
    throw new Error('DATABASE_PATH and UPLOAD_DIR must be absolute persistent-disk paths in production.');
  }
  if (process.env.ADMIN_USERNAME === 'admin' || process.env.ADMIN_PASSWORD === 'admin123' || process.env.SESSION_SECRET.length < 32) {
    throw new Error('Production credentials must be changed and SESSION_SECRET must contain at least 32 characters.');
  }
}
if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
const uploadDir = path.resolve(process.env.UPLOAD_DIR || path.join(ROOT, 'uploads'));
const databasePath = path.resolve(process.env.DATABASE_PATH || path.join(ROOT, 'database', 'classhub.db'));
const dbDir = path.dirname(databasePath);
fs.mkdirSync(uploadDir, { recursive: true }); fs.mkdirSync(dbDir, { recursive: true });
const db = new DatabaseSync(databasePath);
db.exec('PRAGMA journal_mode = WAL');
db.transaction = (callback) => (...args) => {
  db.exec('BEGIN');
  try { const result = callback(...args); db.exec('COMMIT'); return result; }
  catch (error) { db.exec('ROLLBACK'); throw error; }
};
db.exec(`
CREATE TABLE IF NOT EXISTS students (id INTEGER PRIMARY KEY, student_id TEXT NOT NULL, name TEXT NOT NULL, session_token TEXT NOT NULL UNIQUE, ip_address TEXT, created_at INTEGER NOT NULL, last_seen INTEGER NOT NULL, cooldown_until INTEGER, simulated INTEGER NOT NULL DEFAULT 0);
CREATE TABLE IF NOT EXISTS announcements (id INTEGER PRIMARY KEY, title TEXT NOT NULL, content TEXT NOT NULL, created_at INTEGER NOT NULL, created_by TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS materials (id INTEGER PRIMARY KEY, title TEXT NOT NULL, filename TEXT NOT NULL, original_name TEXT NOT NULL, file_size INTEGER NOT NULL, uploaded_at INTEGER NOT NULL, uploaded_by TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id), session_token TEXT NOT NULL, ip_address TEXT, started_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, cooldown_until INTEGER, status TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS access_queue (id INTEGER PRIMARY KEY, student_id INTEGER NOT NULL REFERENCES students(id), requested_at INTEGER NOT NULL, status TEXT NOT NULL, granted_at INTEGER);
CREATE TABLE IF NOT EXISTS web_sessions (sid TEXT PRIMARY KEY, data TEXT NOT NULL, expires_at INTEGER NOT NULL);
`);
const config = { maxActiveSessions: Math.max(1, Number(process.env.MAX_ACTIVE_SESSIONS) || 8), sessionDuration: Math.max(5, Number(process.env.SESSION_DURATION) || 90), cooldownDuration: Math.max(0, Number(process.env.COOLDOWN_DURATION) || 180) };
const scheduler = createScheduler(db, config);
const classroomEnabled = process.env.CLASSROOM_ENABLED !== 'false';
const expectedUser = process.env.ADMIN_USERNAME || 'admin';
const expectedPassword = process.env.ADMIN_PASSWORD || 'admin123';
const adminPasswordHash = bcrypt.hash(expectedPassword, 10);

app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
class SQLiteSessionStore extends session.Store {
  constructor(database) { super(); this.database = database; }
  get(sid, callback) {
    try {
      const row = this.database.prepare('SELECT data,expires_at FROM web_sessions WHERE sid=?').get(sid);
      if (!row) return callback(null, null);
      if (row.expires_at <= Date.now()) { this.destroy(sid, () => callback(null, null)); return; }
      callback(null, JSON.parse(row.data));
    } catch (error) { callback(error); }
  }
  set(sid, value, callback = () => { }) {
    try {
      const expiresAt = value.cookie?.expires ? new Date(value.cookie.expires).getTime() : Date.now() + 12 * 60 * 60 * 1000;
      this.database.prepare('INSERT INTO web_sessions (sid,data,expires_at) VALUES (?,?,?) ON CONFLICT(sid) DO UPDATE SET data=excluded.data,expires_at=excluded.expires_at').run(sid, JSON.stringify(value), expiresAt);
      callback(null);
    } catch (error) { callback(error); }
  }
  destroy(sid, callback = () => { }) {
    try { this.database.prepare('DELETE FROM web_sessions WHERE sid=?').run(sid); callback(null); }
    catch (error) { callback(error); }
  }
  touch(sid, value, callback = () => { }) { this.set(sid, value, callback); }
}
app.use(session({ name: 'classhub.sid', store: new SQLiteSessionStore(db), secret: process.env.SESSION_SECRET || 'classhub-local-development-secret-change-me', resave: false, saveUninitialized: false, rolling: true, cookie: { httpOnly: true, sameSite: 'lax', secure: isProduction, maxAge: 12 * 60 * 60 * 1000 } }));
app.use((req, res, next) => {
  const classroomPath = ['/teacher', '/student', '/teacher.html', '/student.html'].includes(req.path) || ['/api/auth/teacher', '/api/auth/student', '/api/student', '/api/teacher', '/api/materials'].some(prefix => req.path === prefix || req.path.startsWith(`${prefix}/`));
  if (!classroomEnabled && classroomPath) return res.status(404).sendFile(path.join(ROOT, 'public', '404.html'));
  next();
});
app.use('/api', (req, res, next) => {
  if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
    const key = req.ip; const now = Date.now(); const rate = limits.get(key) || { start: now, count: 0 };
    if (now - rate.start > 60_000) { rate.start = now; rate.count = 0; }
    rate.count++; limits.set(key, rate); if (rate.count > 100) return res.status(429).json({ error: 'Too many requests. Try again shortly.' });
  }
  next();
});
const limits = new Map(); setInterval(() => { for (const [key, item] of limits) if (Date.now() - item.start > 120_000) limits.delete(key); }, 60_000).unref();
app.use(express.static(path.join(ROOT, 'public'), { index: false, fallthrough: true }));
const timestamp = () => Math.floor(Date.now() / 1000);
const safeText = (value, max) => typeof value === 'string' ? value.trim().slice(0, max) : '';
const teacherOnly = (req, res, next) => req.session.teacher ? next() : res.status(401).json({ error: 'Teacher login required.' });
const studentOnly = (req, res, next) => {
  if (!req.session.student?.id || !req.session.student?.token) return res.status(401).json({ error: 'Join ClassHub to continue.' });
  const student = db.prepare('SELECT * FROM students WHERE id=? AND session_token=?').get(req.session.student.id, req.session.student.token);
  if (!student) return res.status(401).json({ error: 'Student session expired. Please join again.' });
  db.prepare('UPDATE students SET last_seen=? WHERE id=?').run(timestamp(), student.id); req.student = student; next();
};
const extAllowed = new Set(['.pdf', '.ppt', '.pptx', '.doc', '.docx', '.txt', '.jpg', '.jpeg', '.png', '.zip']);
const storage = multer.diskStorage({ destination: uploadDir, filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${path.extname(file.originalname).toLowerCase()}`) });
const upload = multer({ storage, limits: { fileSize: (Number(process.env.MAX_UPLOAD_MB) || 25) * 1024 * 1024 }, fileFilter: (req, file, cb) => extAllowed.has(path.extname(file.originalname).toLowerCase()) ? cb(null, true) : cb(new Error('Unsupported file type.')) });

app.get('/api/status', (req, res) => res.json({ online: true, config: { maxActiveSessions: config.maxActiveSessions, sessionDuration: config.sessionDuration, cooldownDuration: config.cooldownDuration }, addresses: Object.values(os.networkInterfaces()).flat().filter(x => x && x.family === 'IPv4' && !x.internal).map(x => x.address) }));
app.get('/api/me', (req, res) => res.json({ role: req.session.teacher ? 'teacher' : req.session.student ? 'student' : null }));
app.post('/api/auth/teacher', async (req, res) => {
  const username = safeText(req.body?.username, 80); const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (username !== expectedUser || !(await bcrypt.compare(password, await adminPasswordHash))) return res.status(401).json({ error: 'Check your username and password.' });
  req.session.regenerate(err => { if (err) return res.status(500).json({ error: 'Could not start teacher session.' }); req.session.teacher = { username }; res.json({ ok: true }); });
});
app.post('/api/auth/student', (req, res) => {
  const id = safeText(req.body?.studentId, 40); const name = safeText(req.body?.name, 80);
  if (!id || !name) return res.status(400).json({ error: 'Enter both your student ID and name.' });
  const token = crypto.randomBytes(32).toString('hex'); const now = timestamp(); const ip = req.ip;
  let student = db.prepare('SELECT * FROM students WHERE student_id=? AND simulated=0').get(id);
  if (student) db.prepare('UPDATE students SET name=?, session_token=?, ip_address=?, last_seen=? WHERE id=?').run(name, token, ip, now, student.id);
  else { const result = db.prepare('INSERT INTO students (student_id,name,session_token,ip_address,created_at,last_seen) VALUES (?,?,?,?,?,?)').run(id, name, token, ip, now, now); student = { id: Number(result.lastInsertRowid) }; }
  req.session.regenerate(err => { if (err) return res.status(500).json({ error: 'Could not start student session.' }); req.session.student = { id: student.id, token }; res.json({ ok: true }); });
});
app.post('/api/auth/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));

app.get('/api/student/dashboard', studentOnly, (req, res) => {
  scheduler.expireAndPromote();
  const announcements = db.prepare('SELECT id,title,content,created_at FROM announcements ORDER BY created_at DESC,id DESC').all();
  const materials = db.prepare('SELECT id,title,original_name,file_size,uploaded_at FROM materials ORDER BY uploaded_at DESC,id DESC').all();
  res.json({ student: { id: req.student.student_id, name: req.student.name }, announcements, materials, session: scheduler.statusFor(req.student.id), config: { maxActiveSessions: config.maxActiveSessions } });
});
app.get('/api/student/session', studentOnly, (req, res) => res.json({ session: scheduler.statusFor(req.student.id) }));
app.post('/api/student/session/request', studentOnly, (req, res) => res.json({ session: scheduler.request(req.student.id) }));
app.post('/api/student/session/cancel', studentOnly, (req, res) => { scheduler.cancelQueue(req.student.id); res.json({ session: scheduler.statusFor(req.student.id) }); });
app.get('/api/student/materials', studentOnly, (req, res) => {
  const search = safeText(req.query.q, 100); const rows = search ? db.prepare('SELECT id,title,original_name,file_size,uploaded_at FROM materials WHERE title LIKE ? OR original_name LIKE ? ORDER BY uploaded_at DESC').all(`%${search}%`, `%${search}%`) : db.prepare('SELECT id,title,original_name,file_size,uploaded_at FROM materials ORDER BY uploaded_at DESC').all();
  res.json({ materials: rows });
});
app.get('/api/materials/:id/download', studentOnly, (req, res) => {
  const access = scheduler.statusFor(req.student.id); if (access.state !== 'active') return res.status(403).json({ error: 'Request an active resource session before downloading.', session: access });
  const material = db.prepare('SELECT * FROM materials WHERE id=?').get(Number(req.params.id)); if (!material) return res.status(404).json({ error: 'Material not found.' });
  const filePath = path.resolve(uploadDir, material.filename); if (!filePath.startsWith(uploadDir + path.sep) || !fs.existsSync(filePath)) return res.status(404).json({ error: 'File is unavailable.' });
  res.download(filePath, material.original_name);
});

app.get('/api/teacher/dashboard', teacherOnly, (req, res) => {
  scheduler.expireAndPromote();
  const stats = {
    active: db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE status='active' AND expires_at > ?").get(timestamp()).n,
    queue: db.prepare("SELECT COUNT(*) AS n FROM access_queue WHERE status='waiting'").get().n,
    materials: db.prepare('SELECT COUNT(*) AS n FROM materials').get().n,
    announcements: db.prepare('SELECT COUNT(*) AS n FROM announcements').get().n,
    realStudents: db.prepare('SELECT COUNT(*) AS n FROM students WHERE simulated=0 AND last_seen>?').get(timestamp() - 86400).n,
    simulatedStudents: db.prepare('SELECT COUNT(*) AS n FROM students WHERE simulated=1').get().n
  };
  const active = db.prepare("SELECT s.id,s.student_id,s.name,s.simulated,x.started_at,x.expires_at FROM sessions x JOIN students s ON s.id=x.student_id WHERE x.status='active' AND x.expires_at>? ORDER BY x.started_at").all(timestamp());
  const queue = db.prepare("SELECT q.id,q.requested_at,s.student_id,s.name,s.simulated FROM access_queue q JOIN students s ON s.id=q.student_id WHERE q.status='waiting' ORDER BY q.requested_at,q.id").all();
  const materials = db.prepare('SELECT * FROM materials ORDER BY uploaded_at DESC,id DESC').all(); const announcements = db.prepare('SELECT * FROM announcements ORDER BY created_at DESC,id DESC').all();
  res.json({ stats, active, queue, materials, announcements, config: { ...config } });
});
app.post('/api/teacher/announcements', teacherOnly, (req, res) => {
  const title = safeText(req.body?.title, 120); const content = safeText(req.body?.content, 3000);
  if (!title || !content) return res.status(400).json({ error: 'Add a title and message.' });
  db.prepare('INSERT INTO announcements (title,content,created_at,created_by) VALUES (?,?,?,?)').run(title, content, timestamp(), req.session.teacher.username); res.json({ ok: true });
});
app.delete('/api/teacher/announcements/:id', teacherOnly, (req, res) => { db.prepare('DELETE FROM announcements WHERE id=?').run(Number(req.params.id)); res.json({ ok: true }); });
app.post('/api/teacher/materials', teacherOnly, (req, res) => upload.single('file')(req, res, err => {
  if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'File exceeds the upload size limit.' : err.message === 'Unsupported file type.' ? err.message : 'The file could not be uploaded.' });
  if (!req.file) return res.status(400).json({ error: 'Choose a file to upload.' });
  const title = safeText(req.body.title, 120) || path.parse(req.file.originalname).name;
  db.prepare('INSERT INTO materials (title,filename,original_name,file_size,uploaded_at,uploaded_by) VALUES (?,?,?,?,?,?)').run(title, req.file.filename, path.basename(req.file.originalname), req.file.size, timestamp(), req.session.teacher.username); res.json({ ok: true });
}));
app.delete('/api/teacher/materials/:id', teacherOnly, (req, res) => { const item = db.prepare('SELECT filename FROM materials WHERE id=?').get(Number(req.params.id)); if (item) { db.prepare('DELETE FROM materials WHERE id=?').run(Number(req.params.id)); const p = path.resolve(uploadDir, item.filename); if (p.startsWith(uploadDir + path.sep)) fs.rmSync(p, { force: true }); } res.json({ ok: true }); });
app.post('/api/teacher/simulate', teacherOnly, (req, res) => {
  db.prepare("DELETE FROM access_queue WHERE student_id IN (SELECT id FROM students WHERE simulated=1)").run();
  db.prepare("DELETE FROM sessions WHERE student_id IN (SELECT id FROM students WHERE simulated=1)").run(); db.prepare('DELETE FROM students WHERE simulated=1').run();
  const add = db.prepare('INSERT INTO students (student_id,name,session_token,ip_address,created_at,last_seen,simulated) VALUES (?,?,?,?,?,?,1)'); const now = timestamp();
  const request = db.transaction(() => { for (let i = 1; i <= 20; i++) { const label = `Student ${String(i).padStart(2, '0')}`; const id = Number(add.run(`DEMO-${String(i).padStart(2, '0')}`, label, crypto.randomBytes(32).toString('hex'), 'simulation', now, now).lastInsertRowid); scheduler.request(id); } }); request(); res.json({ ok: true });
});
app.post('/api/teacher/simulate/clear', teacherOnly, (req, res) => { db.prepare("DELETE FROM access_queue WHERE student_id IN (SELECT id FROM students WHERE simulated=1)").run(); db.prepare("DELETE FROM sessions WHERE student_id IN (SELECT id FROM students WHERE simulated=1)").run(); db.prepare('DELETE FROM students WHERE simulated=1').run(); res.json({ ok: true }); });

app.get('/', (req, res) => res.sendFile(path.join(ROOT, 'public', 'index.html')));
const publicPages = ['about', 'how-it-works', 'features', 'developer', 'contact', 'privacy', 'terms', 'classroom'];
for (const page of publicPages) app.get(`/${page}`, (req, res) => res.sendFile(path.join(ROOT, 'public', `${page}.html`)));
app.get('/robots.txt', (req, res) => {
  const origin = process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`;
  res.type('text/plain').send(`User-agent: *\nAllow: /\nDisallow: /teacher\nDisallow: /student\nDisallow: /api/\nSitemap: ${origin.replace(/\/$/, '')}/sitemap.xml\n`);
});
app.get('/sitemap.xml', (req, res) => {
  const origin = (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
  const xmlOrigin = origin.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  const paths = ['/', '/about', '/how-it-works', '/features', '/developer', '/contact', '/privacy', '/terms'];
  res.type('application/xml').send(`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${paths.map(page => `<url><loc>${xmlOrigin}${page}</loc></url>`).join('')}</urlset>`);
});
app.get('/teacher', (req, res) => res.sendFile(path.join(ROOT, 'public', 'teacher.html')));
app.get('/student', (req, res) => res.sendFile(path.join(ROOT, 'public', 'student.html')));
app.get('/404', (req, res) => res.status(404).sendFile(path.join(ROOT, 'public', '404.html')));
app.get('/500', (req, res) => res.status(500).sendFile(path.join(ROOT, 'public', '500.html')));
app.use((req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'The requested endpoint was not found.' });
  res.status(404).sendFile(path.join(ROOT, 'public', '404.html'));
});
app.use((error, req, res, next) => {
  console.error(`[request error] ${req.method} ${req.path}: ${error.message}`);
  if (res.headersSent) return next(error);
  const status = Number(error.status) >= 400 && Number(error.status) < 600 ? Number(error.status) : 500;
  if (req.path.startsWith('/api/')) return res.status(status).json({ error: status === 413 ? 'Request is too large.' : status < 500 ? error.message : 'The request could not be completed.' });
  res.status(status).sendFile(path.join(ROOT, status === 404 ? 'public/404.html' : 'public/500.html'));
});
setInterval(() => db.prepare('DELETE FROM web_sessions WHERE expires_at<=?').run(Date.now()), 60 * 60 * 1000).unref();
setInterval(() => scheduler.expireAndPromote(), 5000).unref();
app.listen(PORT, '0.0.0.0', () => console.log(`ClassHub listening on http://0.0.0.0:${PORT}`));
