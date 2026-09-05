const fs = require('fs');
const path = require('path');

const serverPath = path.join(process.cwd(), 'server.ts');
let serverContent = fs.readFileSync(serverPath, 'utf-8');

if (!serverContent.includes("import { otpRouter }")) {
    serverContent = serverContent.replace("import { authRouter } from './server/routes/auth';", "import { authRouter } from './server/routes/auth';\nimport { otpRouter } from './server/routes/otp';");
    fs.writeFileSync(serverPath, serverContent, 'utf-8');
}
console.log('Fixed server.ts imports');
