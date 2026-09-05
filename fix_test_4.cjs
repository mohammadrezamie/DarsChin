const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'tests/academic-rules.test.ts');
let content = fs.readFileSync(p, 'utf-8');
content = content.replace(/offerings:/g, "currentOfferings:");
fs.writeFileSync(p, content, 'utf-8');
