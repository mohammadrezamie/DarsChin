const fs = require('fs');
const path = require('path');

const navPath = path.join(process.cwd(), 'src/components/Navbar.tsx');
let content = fs.readFileSync(navPath, 'utf-8');

content = content.replace(
  /\{\(user\?\.roles\?\.includes\('admin'\) \|\| user\?\.roles\?\.includes\('super-admin'\)\) && \(/g,
  "{(user?.roles?.includes('super-admin') || user?.permissions?.includes('admin.panel.access')) && ("
);

fs.writeFileSync(navPath, content, 'utf-8');
console.log('Fixed Navbar perms');
