const fs = require('fs');
const path = require('path');

const adminPath = path.join(process.cwd(), 'server/routes/admin.ts');
let content = fs.readFileSync(adminPath, 'utf-8');

const backupIdx = content.indexOf("adminRouter.get('/backup'");
const restoreIdx = content.indexOf("adminRouter.post('/restore'");
if (backupIdx !== -1 && restoreIdx !== -1) {
    const replacement = `adminRouter.get('/backup', authenticate, requirePermission('backup.manage'), (req, res) => {
  const backup = db.exportBackup();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', \`attachment; filename=darschyn-backup-\${Date.now()}.json\`);
  res.json(backup);
});

// Restore Database Backup
`;
    content = content.substring(0, backupIdx) + replacement + content.substring(restoreIdx);
}

fs.writeFileSync(adminPath, content, 'utf-8');
console.log('Fixed backup syntax');
