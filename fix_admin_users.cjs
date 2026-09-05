const fs = require('fs');
const path = require('path');
const curPath = path.join(process.cwd(), 'server/routes/admin.ts');

let content = fs.readFileSync(curPath, 'utf-8');

if (content.includes('const safeUsers = db.users.map((u) => {') && !content.includes('const profile = db.studentProfiles.find((p) => p.userId === u.id);')) {
  content = content.replace(
    'const safeUsers = db.users.map((u) => {',
    'const safeUsers = db.users.map((u) => {\n      const profile = db.studentProfiles.find((p) => p.userId === u.id);'
  );
  content = content.replace(
    'roles: Array.isArray(safe.roles) ? safe.roles : [(safe as any).roles || \'student\'],',
    'roles: Array.isArray(safe.roles) ? safe.roles : [(safe as any).roles || \'student\'],\n        profile,'
  );
  fs.writeFileSync(curPath, content, 'utf-8');
  console.log('admin.ts users populated with profile.');
} else {
  console.log('Skipped, could not find injection point');
}
