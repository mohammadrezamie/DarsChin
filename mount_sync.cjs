const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'server.ts');
let content = fs.readFileSync(file, 'utf-8');

if (!content.includes('import { syncRouter }')) {
    content = content.replace("import { importsRouter } from './server/routes/imports';", "import { importsRouter } from './server/routes/imports';\nimport { syncRouter } from './server/routes/sync';");
    content = content.replace("app.use('/api/imports', importsRouter);", "app.use('/api/imports', importsRouter);\n  app.use('/api/sync', syncRouter);");
}

fs.writeFileSync(file, content);
