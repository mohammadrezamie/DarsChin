const fs = require('fs');
const path = require('path');

const authPath = path.join(process.cwd(), 'server/routes/auth.ts');
let content = fs.readFileSync(authPath, 'utf-8');

content = content.replace(
  "if (!user || !user.password) {",
  "if (user && user.deactivatedAt) {\n    return res.status(403).json({\n      success: false,\n      error: 'حساب کاربری شما غیرفعال شده است.',\n    });\n  }\n\n  if (!user || !user.password) {"
);

fs.writeFileSync(authPath, content, 'utf-8');
console.log('Fixed deactivated auth');
