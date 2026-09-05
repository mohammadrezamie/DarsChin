const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'tests/academic-rules.test.ts');
let content = fs.readFileSync(p, 'utf-8');
content = content.replace(/academicRules: academicRules as any,/g, "academicRules: academicRules as any,\n      tracks: [],");
fs.writeFileSync(p, content, 'utf-8');
