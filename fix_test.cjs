const fs = require('fs');
const path = require('path');

const testPath = path.join(process.cwd(), 'tests/security.test.ts');
let content = fs.readFileSync(testPath, 'utf-8');

// I'll rewrite the create admin test and OTP test
const createAdminSearch = `    it("Root owner can create admins", async () => {`;
const createAdminReplace = `    it("Root owner can create admins", async () => {
        const randomMobile = \`09000\${Math.floor(Math.random() * 1000000)}\`;
        const res = await request(app)
            .post('/api/admin-management')
            .set('Authorization', \`Bearer \${rootToken}\`)
            .send({ name: 'NewAdmin2', mobile: randomMobile, password: '123', roles: ['admin'] });
            
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        const newAdmin = db.users.find(u => u.mobile === randomMobile);
        expect(newAdmin).toBeDefined();
        expect(newAdmin?.createdBy).toBe(rootUser.id);
    });`;

// Replace from create admins to OTP login flow
const start1 = content.indexOf(`    it("Root owner can create admins"`);
const end1 = content.indexOf(`    it("OTP login flow"`);

if (start1 !== -1 && end1 !== -1) {
    content = content.substring(0, start1) + createAdminReplace + '\n\n' + content.substring(end1);
}

// Rewrite OTP test
const otpReplace = `    it("OTP login flow", async () => {
        db.otpChallenges = []; // reset rate limits for test
        const testMobile = '09000000001';
        
        // Generate CAPTCHA
        const captchaRes = await request(app).get('/api/auth/otp/captcha/generate');
        const captchaId = captchaRes.body.data?.id;
        const captchaText = captchaRes.body.data?.text;
        
        // Send OTP
        const otpSendRes = await request(app).post('/api/auth/otp/send').send({
            mobile: testMobile, // existing student
            purpose: 'login',
            captchaId,
            captchaValue: captchaText
        });
        expect(otpSendRes.status).toBe(200);
        const challengeId = otpSendRes.body.data.challengeId;
        const code = otpSendRes.body.data.code;
        
        // Verify OTP
        const verifyRes = await request(app).post('/api/auth/otp/verify').send({
            mobile: testMobile,
            challengeId,
            code
        });
        expect(verifyRes.status).toBe(200);
        expect(verifyRes.body.data.token).toBeDefined();
    });`;

const start2 = content.indexOf(`    it("OTP login flow"`);
const end2 = content.lastIndexOf(`});`);

if (start2 !== -1 && end2 !== -1) {
    content = content.substring(0, start2) + otpReplace + '\n\n});\n';
}

fs.writeFileSync(testPath, content, 'utf-8');
console.log('Fixed tests');
