const fs = require('fs');
const path = require('path');

const authPath = path.join(process.cwd(), 'server/routes/auth.ts');
let content = fs.readFileSync(authPath, 'utf-8');

// Replace hardcoded ensureSuperAdmin function
content = content.replace(/function ensureSuperAdmin\(\) \{[\s\S]*?\}\n/, '');
content = content.replace('ensureSuperAdmin();\n', '');

// Replace dynamic checks
content = content.replace(/mobile === '09911902465'/g, "mobile === process.env.ROOT_OWNER_MOBILE");
content = content.replace(/user\.mobile === '09911902465'/g, "user.mobile === process.env.ROOT_OWNER_MOBILE");

fs.writeFileSync(authPath, content, 'utf-8');
console.log('Fixed hardcoded mobile in auth');
