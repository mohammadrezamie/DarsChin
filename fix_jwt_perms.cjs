const fs = require('fs');
const path = require('path');

const middlewarePath = path.join(process.cwd(), 'server/middleware/auth.ts');
let content = fs.readFileSync(middlewarePath, 'utf-8');

content = content.replace(
  "return jwt.sign(\n    { id: user.id, mobile: user.mobile, roles, name: user.name },",
  "return jwt.sign(\n    { id: user.id, mobile: user.mobile, roles, permissions: user.permissions || [], name: user.name },"
);
content = content.replace(
  "const decoded = jwt.verify(token, JWT_SECRET) as { id: string; roles?: UserRole[] };",
  "const decoded = jwt.verify(token, JWT_SECRET) as { id: string; roles?: UserRole[], permissions?: string[] };"
);

fs.writeFileSync(middlewarePath, content, 'utf-8');
console.log('Fixed JWT perms');
