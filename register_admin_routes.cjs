const fs = require('fs');
const path = require('path');

const serverPath = path.join(process.cwd(), 'server.ts');
let content = fs.readFileSync(serverPath, 'utf-8');

if (!content.includes('adminManagementRouter')) {
    content = content.replace(
        "import { adminRouter } from './server/routes/admin';",
        "import { adminRouter } from './server/routes/admin';\nimport { adminManagementRouter } from './server/routes/admin-management';"
    );
    content = content.replace(
        "app.use('/api/admin', adminRouter);",
        "app.use('/api/admin', adminRouter);\napp.use('/api/admin-management', adminManagementRouter);"
    );
    fs.writeFileSync(serverPath, content, 'utf-8');
    console.log('Registered adminManagementRouter');
}
