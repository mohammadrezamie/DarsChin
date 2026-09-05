const fs = require('fs');
const path = require('path');
const curPath = path.join(process.cwd(), 'server/routes/admin.ts');

let content = fs.readFileSync(curPath, 'utf-8');

content = content.replace(
  'const safeUsers = db.users.map((u) => {\n      const { password, ...safe } = u;\n      return {\n        ...safe,\n        roles: Array.isArray(safe.roles) ? safe.roles : [(safe as any).roles || \'student\'],\n      };\n    });',
  'const safeUsers = db.users.map((u) => {\n      const { password, ...safe } = u;\n      const profile = db.studentProfiles.find(p => p.userId === u.id);\n      return {\n        ...safe,\n        roles: Array.isArray(safe.roles) ? safe.roles : [(safe as any).roles || \'student\'],\n        profile\n      };\n    });'
);

fs.writeFileSync(curPath, content, 'utf-8');
console.log('Fixed admin.ts');
