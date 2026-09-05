const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.cwd(), 'server/db/database.ts');
let content = fs.readFileSync(dbPath, 'utf-8');

// The LocalDatabase class starts with:
// public data: DatabaseSchema = {
//   users: [],
// ...
// Let's ensure otpChallenges and captchaChallenges are in there.

content = content.replace(
  "errorLogs: [],",
  "errorLogs: [],\n    otpChallenges: [],\n    captchaChallenges: [],"
);

// Also in the init() function when parsing JSON:
// if (!this.data.errorLogs) this.data.errorLogs = [];
const regex = /if \(\!this\.data\.errorLogs\) this\.data\.errorLogs \= \[\];/g;
content = content.replace(regex, "if (!this.data.errorLogs) this.data.errorLogs = [];\n        if (!this.data.otpChallenges) this.data.otpChallenges = [];\n        if (!this.data.captchaChallenges) this.data.captchaChallenges = [];");

fs.writeFileSync(dbPath, content, 'utf-8');
console.log('Fixed DB Init');
