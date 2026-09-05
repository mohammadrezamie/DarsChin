const fs = require('fs');
const path = require('path');

const authCtxPath = path.join(process.cwd(), 'src/context/AuthContext.tsx');
let content = fs.readFileSync(authCtxPath, 'utf-8');

content = content.replace(
  "roles: claims.roles || ['student'],\n        } as User;",
  "roles: claims.roles || ['student'],\n          permissions: claims.permissions || [],\n        } as User;"
);

fs.writeFileSync(authCtxPath, content, 'utf-8');
console.log('Fixed AuthContext perms');
