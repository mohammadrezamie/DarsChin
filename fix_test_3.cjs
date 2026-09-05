const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'tests/academic-rules.test.ts');
let content = fs.readFileSync(p, 'utf-8');
content = content.replace(/studentId: 'user1',/g, "studentId: 'user1',\n      studentProfile: {} as any,");
fs.writeFileSync(p, content, 'utf-8');
