const fs = require('fs');
const path = require('path');

const adminPath = path.join(process.cwd(), 'server/routes/admin.ts');
let content = fs.readFileSync(adminPath, 'utf-8');

content = content.replace(/adminRouter\.post\('\/restore', authenticate, requirePermissiadminRouter\.get\('\/backup', authenticate, requirePermission\('backup\.manage'\),/g, "adminRouter.post('/restore', authenticate, requirePermission('backup.manage'),");

fs.writeFileSync(adminPath, content, 'utf-8');
console.log('Fixed restore syntax');
