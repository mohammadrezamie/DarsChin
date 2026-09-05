const fs = require('fs');
const path = require('path');

// Fix database.ts UserRole import
const dbPath = path.join(process.cwd(), 'server/db/database.ts');
let dbContent = fs.readFileSync(dbPath, 'utf-8');
dbContent = dbContent.replace(
    "ErrorLog",
    "ErrorLog, UserRole"
);
fs.writeFileSync(dbPath, dbContent, 'utf-8');

// Fix server.ts otpRouter import missing
const serverPath = path.join(process.cwd(), 'server.ts');
let serverContent = fs.readFileSync(serverPath, 'utf-8');
if (!serverContent.includes("import { otpRouter }")) {
    serverContent = serverContent.replace("import authRouter from './server/routes/auth';", "import authRouter from './server/routes/auth';\nimport { otpRouter } from './server/routes/otp';");
    fs.writeFileSync(serverPath, serverContent, 'utf-8');
} else {
    // If it's already there but somehow still throwing an error, let's verify if `otpRouter` is exported correctly in `server/routes/otp.ts`.
    // It is `export const otpRouter = Router();`
}
console.log('Fixed lint 2');
