const fs = require('fs');
const path = require('path');

const adminPath = path.join(process.cwd(), 'server/routes/admin.ts');
let content = fs.readFileSync(adminPath, 'utf-8');

content = content.replace(
    "  res.json({\n      totalUsers: db.users.length,",
    "  res.json({\n      success: true,\n      data: {\n        totalUsers: db.users.length,"
);

fs.writeFileSync(adminPath, content, 'utf-8');
console.log('Fixed admin syntax');
