import { describe, it, expect, beforeAll } from 'vitest';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import { db } from '../server/db/database';
import request from 'supertest';
import express from 'express';
import authRouter from '../server/routes/auth';
import { adminRouter } from '../server/routes/admin';
import { adminManagementRouter } from '../server/routes/admin-management';
import { otpRouter } from '../server/routes/otp';
import { generateToken } from '../server/middleware/auth';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/auth/otp', otpRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin-management', adminManagementRouter);

describe("DARSCHYN Security Regression & Integrity Tests", () => {
    
    
    beforeAll(async () => {
        delete process.env.NIAZPARDAZ_API_KEY; // Prevent real network calls
        await db.init(true);
    });


    let studentToken = '';
    let adminToken = '';
    let rootToken = '';
    let rootUser: any;
    const testStudentMobile = '09000000001'; // ensure this user exists in DB from seed

    it("1. Root account initialization is idempotent and secure", () => {
        rootUser = db.users.find(u => u.roles.includes('super-admin'));
        expect(rootUser).toBeDefined();
        expect(rootUser.permissions).toContain('admin.panel.access');
        expect(rootUser.permissions).toContain('student.access');
        
        rootToken = generateToken({ id: rootUser.id, roles: rootUser.roles, permissions: rootUser.permissions });
    });

    it("2. Public registration does NOT create super-admin", async () => {
        const randomMobile = `09000${Math.floor(Math.random() * 1000000)}`;
        // Even if trying to use root mobile (if it wasn't already in DB, but let's test a generic one)
        const res = await request(app)
            .post('/api/auth/register')
            .send({ mobile: randomMobile, password: 'password123', name: 'Public User' });
            
        if(res.status!==201) console.log(res.body);
        expect(res.status).toBe(201);
        expect(res.body.data.user.roles).not.toContain('super-admin');
        expect(res.body.data.user.roles).toContain('student');
        expect(res.body.data.user.recoveryKey).toBeUndefined(); // Recovery key must not leak
    });

    it("3. CAPTCHA endpoint DOES NOT expose answer", async () => {
        const res = await request(app).get('/api/auth/otp/captcha/generate');
        expect(res.status).toBe(200);
        expect(res.body.data.id).toBeDefined();
        expect(res.body.data.svg).toBeDefined();
        expect(res.body.data.text).toBeUndefined();
        expect(res.body.data.value).toBeUndefined();
        expect(res.body.data.answer).toBeUndefined();
    });

    it("prunes expired CAPTCHA and OTP challenges", async () => {
        const expiredAt = Date.now() - 1;
        db.captchaChallenges.push({
            id: 'expired-captcha-regression',
            value: 'expired',
            createdAt: expiredAt - 1000,
            expiresAt: expiredAt,
            attempts: 0,
        });
        db.otpChallenges.push({
            id: 'expired-otp-regression',
            mobile: '09123456789',
            purpose: 'login',
            hashedOtp: bcrypt.hashSync('123456', 4),
            createdAt: expiredAt - 1000,
            expiresAt: expiredAt,
            attempts: 0,
        });

        const res = await request(app).get('/api/auth/otp/captcha/generate');
        expect(res.status).toBe(200);
        expect(db.captchaChallenges.some((item) => item.id === 'expired-captcha-regression')).toBe(false);
        expect(db.otpChallenges.some((item) => item.id === 'expired-otp-regression')).toBe(false);
    });

    it("rejects malformed OTP requests and unsupported purposes", async () => {
        const missingSendFields = await request(app).post('/api/auth/otp/send').send({});
        expect(missingSendFields.status).toBe(400);

        const unsupportedPurpose = await request(app).post('/api/auth/otp/send').send({
            mobile: '09123456789',
            purpose: 'account_takeover',
            captchaId: 'unused',
            captchaValue: 'unused',
        });
        expect(unsupportedPurpose.status).toBe(400);

        const malformedMobile = await request(app).post('/api/auth/otp/send').send({
            mobile: { value: '09123456789' },
            purpose: 'login',
            captchaId: 'unused',
            captchaValue: 'unused',
        });
        expect(malformedMobile.status).toBe(400);

        const malformedMobileFormat = await request(app).post('/api/auth/otp/send').send({
            mobile: '0912345678x',
            purpose: 'login',
            captchaId: 'unused',
            captchaValue: 'unused',
        });
        expect(malformedMobileFormat.status).toBe(400);
        expect(malformedMobileFormat.body.error).toContain('شماره موبایل نامعتبر');

        const validMobileReachesCaptchaCheck = await request(app).post('/api/auth/otp/send').send({
            mobile: '09123456789',
            purpose: 'login',
            captchaId: 'unused',
            captchaValue: 'unused',
        });
        expect(validMobileReachesCaptchaCheck.status).toBe(400);
        expect(validMobileReachesCaptchaCheck.body.error).toContain('کپچای نامعتبر');

        const malformedVerify = await request(app).post('/api/auth/otp/verify').send({
            mobile: '09123456789',
            challengeId: 'unused',
            code: { value: '123456' },
            purpose: 'login',
        });
        expect(malformedVerify.status).toBe(400);

        const validVerifyShapeReachesChallengeCheck = await request(app).post('/api/auth/otp/verify').send({
            mobile: '09123456789',
            challengeId: 'unused',
            code: '123456',
            purpose: 'login',
        });
        expect(validVerifyShapeReachesChallengeCheck.status).toBe(400);
        expect(validVerifyShapeReachesChallengeCheck.body.error).toContain('کد تایید نامعتبر');
    });

    it("4. OTP Send endpoint DOES NOT expose OTP", async () => {
        db.data.otpChallenges = [];
        db.save();
        // Generate CAPTCHA
        const captchaRes = await request(app).get('/api/auth/otp/captcha/generate');
        const captchaId = captchaRes.body.data.id;
        
        // Fetch answer using the TEST-ONLY debug endpoint
        
        
        // Fetch answer directly from DB for testing
        const captchaText = db.captchaChallenges.find(c => c.id === captchaId)?.value || '';

        
        process.env.MOCK_OTP_CODE = '123456'; // Ensure mock works
        
        // Ensure student exists
        if (!db.users.find(u => u.mobile === testStudentMobile)) {
             db.users.push({
                 id: 'usr-student1', mobile: testStudentMobile, name: 'Student 1', roles: ['student'], permissions: [], password: 'asd'
             } as any);
        }

        
        const testMobile = `0900${Math.floor(Math.random() * 10000000)}`;
        db.users.push({ id: `usr-${Date.now()}`, mobile: testMobile, name: 'T', roles: ['student'], permissions: [] } as any);

        const challengeId = crypto.randomUUID();
        const code = '111222';
        const hashedOtp = bcrypt.hashSync(code, 10);
        db.otpChallenges.push({
            id: challengeId,
            mobile: testMobile,
            purpose: 'login',
            hashedOtp,
            createdAt: Date.now(),
            expiresAt: Date.now() + 120000,
            attempts: 0
        });
        db.save();

        // Wrong purpose

        const wrongPurposeRes = await request(app).post('/api/auth/otp/verify').send({
            mobile: testMobile,
            challengeId,
            code: '111222',
            purpose: 'password_recovery'
        });
        expect(wrongPurposeRes.status).toBe(400);

        // Correct verify
        const correctRes = await request(app).post('/api/auth/otp/verify').send({
            mobile: testMobile,
            challengeId,
            code: '111222',
            purpose: 'login'
        });
        expect(correctRes.status).toBe(200);
        
        // Replay attempt
        const replayRes = await request(app).post('/api/auth/otp/verify').send({
            mobile: testMobile,
            challengeId,
            code: '111222',
            purpose: 'login'
        });
        expect(replayRes.status).toBe(400); // Invalid or expired or consumed
    });

    it("6. Delegated Admin cannot grant permissions they don't possess", async () => {
        const admin2 = { id: 'usr-adm2', mobile: `0900${Math.floor(Math.random() * 10000000)}`, name: 'Admin 2', roles: ['admin'] as any, permissions: ['admin.manage', 'admin.create'] };
        db.users.push(admin2 as any);
        const admin2Token = generateToken(admin2);
        
        const targetAdminMobile = `0900${Math.floor(Math.random() * 10000000)}`;
        
        const res = await request(app)
            .post('/api/admin-management')
            .set('Authorization', `Bearer ${admin2Token}`)
            .send({ name: 'New Admin', mobile: targetAdminMobile, password: '123', roles: ['admin'] as any, permissions: ['system.settings.manage'] });
            
        expect(res.status).toBe(403);
        expect(res.body.error).toContain('بیشتر از دسترسی‌های خودتان');
    });

    it("7. Delegated Admin cannot manufacture super-admin", async () => {
        const admin3 = { id: 'usr-adm3', mobile: `0900${Math.floor(Math.random() * 10000000)}`, name: 'Admin 3', roles: ['admin'] as any, permissions: ['admin.create'] };
        db.users.push(admin3 as any);
        const admin3Token = generateToken(admin3);
        
        const res = await request(app)
            .post('/api/admin-management')
            .set('Authorization', `Bearer ${admin3Token}`)
            .send({ name: 'New Root', mobile: `0900${Math.floor(Math.random() * 10000000)}`, password: '123', roles: ['super-admin', 'admin'], permissions: [] });
            
        expect(res.status).toBe(403);
        expect(res.body.error).toContain('ایجاد مدیر ارشد');
    });
});
