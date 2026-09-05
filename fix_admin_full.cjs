const fs = require('fs');
const path = require('path');

const adminPath = path.join(process.cwd(), 'server/routes/admin.ts');
let content = fs.readFileSync(adminPath, 'utf-8');

// I will look for any syntax errors by compiling it via typescript, or just replace the problematic chunk
// Wait, the error is at line 42. Let's see lines 35-55
console.log(content.split('\n').slice(30, 50).join('\n'));
