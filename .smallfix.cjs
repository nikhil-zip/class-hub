const fs = require('node:fs');
const replacements = {
  'public/index.html': [['<div id="site-nav"></div><main>', '<div id="site-nav"></div><main id="main-content">']],
  'public/teacher.html': [['Development login: admin / admin123', 'Use your teacher account credentials.']]
};
for (const [file, pairs] of Object.entries(replacements)) { let s = fs.readFileSync(file, 'utf8'); for (const [from, to] of pairs) { if (!s.includes(from)) throw Error(`Missing replacement target in ${file}: ${from}`); s = s.replace(from, to) } fs.writeFileSync(file, s) }
