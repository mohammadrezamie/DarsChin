const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.cwd(), 'server/db/database.ts');
let content = fs.readFileSync(dbPath, 'utf-8');

content = content.replace("    errorLogs: [],\n    otpChallenges: [],\n    captchaChallenges: [],\n    otpChallenges: [],\n    captchaChallenges: [],", "    errorLogs: [],\n    otpChallenges: [],\n    captchaChallenges: [],");

fs.writeFileSync(dbPath, content, 'utf-8');
console.log('Cleaned DB duplicates');
