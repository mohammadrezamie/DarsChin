const fs = require('fs');
const path = require('path');

const authPath = path.join(process.cwd(), 'server/routes/auth.ts');
let content = fs.readFileSync(authPath, 'utf-8');

content = content.replace("permissions: user.permissions || [],\n        permissions: user.permissions || [],", "permissions: user.permissions || [],");

fs.writeFileSync(authPath, content, 'utf-8');
console.log('Fixed duplicate auth perms');
