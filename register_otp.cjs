const fs = require('fs');
const path = require('path');

const serverPath = path.join(process.cwd(), 'server.ts');
let content = fs.readFileSync(serverPath, 'utf-8');

if (!content.includes('otpRouter')) {
    content = content.replace(
        "import authRouter from './server/routes/auth';",
        "import authRouter from './server/routes/auth';\nimport { otpRouter } from './server/routes/otp';"
    );
    content = content.replace(
        "app.use('/api/auth', authRouter);",
        "app.use('/api/auth', authRouter);\napp.use('/api/auth/otp', otpRouter);"
    );
    fs.writeFileSync(serverPath, content, 'utf-8');
    console.log('Registered otpRouter');
}
