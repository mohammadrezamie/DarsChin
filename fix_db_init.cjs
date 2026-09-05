const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.cwd(), 'server/db/database.ts');
let content = fs.readFileSync(dbPath, 'utf-8');

const regex = /if \(\!this\.data\.errorLogs\) this\.data\.errorLogs \= \[\];/;
const replacement = `if (!this.data.errorLogs) this.data.errorLogs = [];
        if (!this.data.otpChallenges) this.data.otpChallenges = [];
        if (!this.data.captchaChallenges) this.data.captchaChallenges = [];`;

content = content.replace(regex, replacement);
fs.writeFileSync(dbPath, content, 'utf-8');
console.log('Fixed db.init');
