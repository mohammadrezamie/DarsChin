const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'tests/engine.test.ts');
let content = fs.readFileSync(p, 'utf-8');

// There is an extra " });" at the end of the file.
content = content.replace("}); });", "});");

fs.writeFileSync(p, content, 'utf-8');
console.log('Fixed engine.test.ts');
