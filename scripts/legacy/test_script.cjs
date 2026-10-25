const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'tests/security.test.ts');
let content = fs.readFileSync(file, 'utf-8');

content = content.replace("expect(res.status).toBe(201);", "if(res.status!==201) console.log(res.body);\n        expect(res.status).toBe(201);");
fs.writeFileSync(file, content);
