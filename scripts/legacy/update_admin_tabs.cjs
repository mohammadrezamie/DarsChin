const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'src/components/AdminDashboard.tsx');
let content = fs.readFileSync(file, 'utf-8');

if (!content.includes("import { AdminSyncStatus }")) {
    content = content.replace("import { UserManagement } from './UserManagement';", "import { UserManagement } from './UserManagement';\nimport { AdminSyncStatus } from './AdminSyncStatus';");
    content = content.replace("{activeTab === 'imports' && <AdminImports />}", "{activeTab === 'imports' && <><AdminSyncStatus /><AdminImports /></>}");
    fs.writeFileSync(file, content);
}
