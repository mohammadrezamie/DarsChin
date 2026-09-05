const fs = require('fs');
const path = require('path');

const otpPath = path.join(process.cwd(), 'server/routes/otp.ts');
let content = fs.readFileSync(otpPath, 'utf-8');

// Update imports
if (!content.includes('NiazpardazSmsClient')) {
    content = content.replace("import bcrypt from 'bcryptjs';", "import bcrypt from 'bcryptjs';\nimport { NiazpardazSmsClient } from 'niazpardazsms';");
}

// Fix OTP length
content = content.replace("const otpCode = Math.floor(10000 + Math.random() * 90000).toString();", "const otpCode = crypto.randomInt(100000, 1000000).toString();");

// Fix Niazpardaz block
const regex = /const apiKey = process\.env\.NIAZPARDAZ_API_KEY;[\s\S]*?(?=res\.json\({ success: true, message)/;
const replacement = `const apiKey = process.env.NIAZPARDAZ_API_KEY;
    if (apiKey) {
        try {
            const client = new NiazpardazSmsClient(apiKey);
            const sender = process.env.NIAZPARDAZ_SENDER_NUMBER || '10001234';
            const messageText = \`کد ورود به درسچین:\\n\${otpCode}\\n\\nاین کد 2 دقیقه اعتبار دارد.\`;
            const result = await client.send(sender, mobile, messageText);
            if (result.resultCode !== 0) {
                console.error('[NIAZPARDAZ] Failed to send SMS:', result);
                // We still proceed, but you might want to return an error in production
            }
        } catch (err) {
            console.error('[NIAZPARDAZ] Error:', err);
        }
    } else {
        console.log(\`[LOCAL OTP] Code for \${mobile}: \${otpCode}\`);
    }
    
    `;
content = content.replace(regex, replacement);

fs.writeFileSync(otpPath, content, 'utf-8');
console.log('Fixed OTP route');
