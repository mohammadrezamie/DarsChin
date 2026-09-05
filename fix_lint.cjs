const fs = require('fs');
const path = require('path');

// 1. Fix server.ts otpRouter import
const serverPath = path.join(process.cwd(), 'server.ts');
let serverContent = fs.readFileSync(serverPath, 'utf-8');
if (!serverContent.includes("import { otpRouter }")) {
    serverContent = serverContent.replace("import authRouter from './server/routes/auth';", "import authRouter from './server/routes/auth';\nimport { otpRouter } from './server/routes/otp';");
    fs.writeFileSync(serverPath, serverContent, 'utf-8');
}

// 2. Fix database.ts UserRole[]
const dbPath = path.join(process.cwd(), 'server/db/database.ts');
let dbContent = fs.readFileSync(dbPath, 'utf-8');
dbContent = dbContent.replace("roles: allRoles,", "roles: allRoles as UserRole[],");
dbContent = dbContent.replace("superAdmin.roles = allRoles;", "superAdmin.roles = allRoles as UserRole[];");
fs.writeFileSync(dbPath, dbContent, 'utf-8');

// 3. Fix seed.ts
const seedPath = path.join(process.cwd(), 'server/db/seed.ts');
let seedContent = fs.readFileSync(seedPath, 'utf-8');
seedContent = seedContent.replace("errorLogs: [],", "errorLogs: [],\n    otpChallenges: [],\n    captchaChallenges: [],");
fs.writeFileSync(seedPath, seedContent, 'utf-8');

// 4. Fix auth.ts ensureSuperAdmin leftover
const authPath = path.join(process.cwd(), 'server/routes/auth.ts');
let authContent = fs.readFileSync(authPath, 'utf-8');
authContent = authContent.replace("ensureSuperAdmin();\n", "");
fs.writeFileSync(authPath, authContent, 'utf-8');

// 5. Fix security.test.ts types
const testPath = path.join(process.cwd(), 'tests/security.test.ts');
let testContent = fs.readFileSync(testPath, 'utf-8');
testContent = testContent.replace("roles: ['student']", "roles: ['student' as any]");
testContent = testContent.replace("roles: ['admin']", "roles: ['admin' as any]");
fs.writeFileSync(testPath, testContent, 'utf-8');

console.log('Fixed linting errors');
