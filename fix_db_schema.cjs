const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.cwd(), 'server/db/database.ts');
let content = fs.readFileSync(dbPath, 'utf-8');

// Add imports
if (!content.includes('OtpChallenge')) {
  content = content.replace('SupportMessage, BugReport, AuditLog, ErrorLog', 'SupportMessage, BugReport, AuditLog, ErrorLog, OtpChallenge, CaptchaChallenge');
}

// Update DatabaseSchema
content = content.replace('  errorLogs: ErrorLog[];\n}', '  errorLogs: ErrorLog[];\n  otpChallenges: OtpChallenge[];\n  captchaChallenges: CaptchaChallenge[];\n}');

// Update initial state
content = content.replace('    errorLogs: [],\n  };', '    errorLogs: [],\n    otpChallenges: [],\n    captchaChallenges: [],\n  };');

fs.writeFileSync(dbPath, content, 'utf-8');
console.log('Fixed DB schema');
