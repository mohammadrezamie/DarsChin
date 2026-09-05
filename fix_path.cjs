const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'server/routes/curriculum.ts');
let content = fs.readFileSync(p, 'utf-8');
content = content.replace(/from '\.\.\/utils\/academic'/g, "from '../../src/utils/academic'");
fs.writeFileSync(p, content, 'utf-8');
console.log('Path fixed.');
