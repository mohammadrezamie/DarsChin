const fs = require('fs');
const path = require('path');

const authPath = path.join(process.cwd(), 'server/routes/auth.ts');
let content = fs.readFileSync(authPath, 'utf-8');

content = content.replace(
  "roles: user.roles,",
  "roles: user.roles,\n        permissions: user.permissions || [],"
);
content = content.replace(
  "roles: user.roles,",
  "roles: user.roles,\n      permissions: user.permissions || [],"
);

// We should also replace generateToken call to include permissions
content = content.replace(
  "const token = generateToken({ id: user.id, roles: user.roles });",
  "const token = generateToken({ id: user.id, roles: user.roles, permissions: user.permissions });"
);
content = content.replace(
  "const refreshedToken = generateToken({ id: user.id, roles: user.roles, mobile: user.mobile, name: user.name });",
  "const refreshedToken = generateToken({ id: user.id, roles: user.roles, permissions: user.permissions, mobile: user.mobile, name: user.name });"
);

fs.writeFileSync(authPath, content, 'utf-8');
console.log('Fixed Auth routes perms response');
