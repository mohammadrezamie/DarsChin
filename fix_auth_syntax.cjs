const fs = require('fs');
const path = require('path');

const authPath = path.join(process.cwd(), 'server/routes/auth.ts');
let content = fs.readFileSync(authPath, 'utf-8');

// I will just replace the specific broken part using a regex
content = content.replace(/\/\/ Ensure Super Admin root account is initialized with hashed password[\s\S]*?\}\n\}/, '');

fs.writeFileSync(authPath, content, 'utf-8');
console.log('Fixed syntax error in auth.ts');
