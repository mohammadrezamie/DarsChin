const fs = require('fs');
const path = require('path');

const appPath = path.join(process.cwd(), 'src/App.tsx');
let content = fs.readFileSync(appPath, 'utf-8');

content = content.replace(
  "if (!user || (!user.roles?.includes('admin') && !user.roles?.includes('super-admin'))) {",
  "if (!user || (!user.roles?.includes('super-admin') && !user.permissions?.includes('admin.panel.access'))) {"
);

fs.writeFileSync(appPath, content, 'utf-8');
console.log('Fixed App.tsx perms');
