function createScheduler(db, config) {
  const now = () => Math.floor(Date.now() / 1000);

  function expireAndPromote() {
    const timestamp = now();
    const expired = db.prepare("SELECT id, student_id FROM sessions WHERE status='active' AND expires_at <= ?").all(timestamp);
    const expire = db.prepare("UPDATE sessions SET status='expired', cooldown_until=? WHERE id=?");
    const cooldownUntil = timestamp + config.cooldownDuration;
    for (const row of expired) {
      expire.run(cooldownUntil, row.id);
      db.prepare('UPDATE students SET cooldown_until=? WHERE id=?').run(cooldownUntil, row.student_id);
    }

    let slots = Math.max(0, config.maxActiveSessions - db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE status='active' AND expires_at > ?").get(timestamp).n);
    const waiting = db.prepare("SELECT q.id AS queue_id, q.student_id FROM access_queue q JOIN students s ON s.id=q.student_id WHERE q.status='waiting' AND (s.cooldown_until IS NULL OR s.cooldown_until <= ?) ORDER BY q.requested_at, q.id").all(timestamp);
    for (const item of waiting) {
      if (!slots) break;
      const student = db.prepare('SELECT session_token, ip_address FROM students WHERE id=?').get(item.student_id);
      db.prepare("INSERT INTO sessions (student_id, session_token, ip_address, started_at, expires_at, status) VALUES (?, ?, ?, ?, ?, 'active')")
        .run(item.student_id, student.session_token, student.ip_address || '', timestamp, timestamp + config.sessionDuration);
      db.prepare("UPDATE access_queue SET status='served', granted_at=? WHERE id=?").run(timestamp, item.queue_id);
      db.prepare('UPDATE students SET cooldown_until=NULL WHERE id=?').run(item.student_id);
      slots -= 1;
    }
    return expired.length;
  }

  function statusFor(studentId) {
    expireAndPromote();
    const timestamp = now();
    const active = db.prepare("SELECT started_at, expires_at FROM sessions WHERE student_id=? AND status='active' AND expires_at>? ORDER BY id DESC LIMIT 1").get(studentId, timestamp);
    if (active) return { state: 'active', startedAt: active.started_at, expiresAt: active.expires_at, remaining: Math.max(0, active.expires_at - timestamp) };
    const queued = db.prepare("SELECT id FROM access_queue WHERE student_id=? AND status='waiting' ORDER BY requested_at, id LIMIT 1").get(studentId);
    if (queued) {
      const position = db.prepare("SELECT COUNT(*) AS n FROM access_queue WHERE status='waiting' AND (requested_at < (SELECT requested_at FROM access_queue WHERE id=?) OR (requested_at=(SELECT requested_at FROM access_queue WHERE id=?) AND id<=?))").get(queued.id, queued.id, queued.id).n;
      return { state: 'waiting', position };
    }
    const student = db.prepare('SELECT cooldown_until FROM students WHERE id=?').get(studentId);
    if (student?.cooldown_until > timestamp) return { state: 'cooldown', remaining: student.cooldown_until - timestamp };
    return { state: 'available' };
  }

  function request(studentId) {
    expireAndPromote();
    const current = statusFor(studentId);
    if (current.state !== 'available') return current;
    const timestamp = now();
    const activeCount = db.prepare("SELECT COUNT(*) AS n FROM sessions WHERE status='active' AND expires_at > ?").get(timestamp).n;
    if (activeCount < config.maxActiveSessions) {
      const s = db.prepare('SELECT session_token, ip_address FROM students WHERE id=?').get(studentId);
      db.prepare("INSERT INTO sessions (student_id, session_token, ip_address, started_at, expires_at, status) VALUES (?, ?, ?, ?, ?, 'active')")
        .run(studentId, s.session_token, s.ip_address || '', timestamp, timestamp + config.sessionDuration);
    } else {
      db.prepare("INSERT INTO access_queue (student_id, requested_at, status) VALUES (?, ?, 'waiting')").run(studentId, timestamp);
    }
    return statusFor(studentId);
  }

  function cancelQueue(studentId) {
    db.prepare("UPDATE access_queue SET status='cancelled' WHERE student_id=? AND status='waiting'").run(studentId);
  }

  return { expireAndPromote, statusFor, request, cancelQueue };
}

module.exports = { createScheduler };
