const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.cwd(), 'server/db/database.ts');
let content = fs.readFileSync(dbPath, 'utf-8');

const replacement = `
  get auditLogs() { return this.data.auditLogs || []; }
  get errorLogs() { return this.data.errorLogs || []; }
  get otpChallenges() { return this.data.otpChallenges || []; }
  get captchaChallenges() { return this.data.captchaChallenges || []; }
`;

content = content.replace("  get auditLogs() { return this.data.auditLogs || []; }\n  get errorLogs() { return this.data.errorLogs || []; }", replacement);

fs.writeFileSync(dbPath, content, 'utf-8');
console.log('Fixed db getters');
