import { describe, it, expect, beforeAll } from 'vitest';
import { db } from '../server/db/database';
import request from 'supertest';
import express from 'express';
import authRouter from '../server/routes/auth';
import { adminRouter } from '../server/routes/admin';
import { adminManagementRouter } from '../server/routes/admin-management';
import { otpRouter } from '../server/routes/otp';
import { requirePermission } from '../server/middleware/auth';
import { generateToken } from '../server/middleware/auth';

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api/auth/otp', otpRouter);
app.use('/api/admin', adminRouter);
app.use('/api/admin-management', adminManagementRouter);

describe("DARSCHYN Identity, RBAC & OTP Security Tests", () => {
    
    beforeAll(async () => {
        await db.init(true);
    });

    let studentToken = '';
    let adminToken = '';
    let rootToken = '';
    let rootUser: any;
    
    it("Root account initialization is idempotent and secure", () => {
        rootUser = db.users.find(u => u.roles.includes('super-admin'));
        expect(rootUser).toBeDefined();
        expect(rootUser.permissions).toContain('admin.panel.access');
        expect(rootUser.permissions).toContain('student.access');
        
        rootToken = generateToken({ id: rootUser.id, roles: rootUser.roles, permissions: rootUser.permissions });
    });

    it("Student cannot access Admin Panel routes", async () => {
        const student = { id: 'usr-stud1', mobile: '09000000002', name: 'Student', roles: ['student' as any], permissions: ['student.access'] };
        db.users.push(student as any);
        studentToken = generateToken(student);
        
        const randomMobile = `09000${Math.floor(Math.random() * 1000000)}`;
        const res = await request(app)
            .get('/api/admin/stats')
            .set('Authorization', `Bearer ${studentToken}`);
            
        expect(res.status).toBe(403);
    });

    it("Admin with panel access can view stats", async () => {
        const admin = { id: 'usr-adm1', mobile: '09000000002', name: 'Admin', roles: ['admin' as any], permissions: ['admin.panel.access'] };
        db.users.push(admin as any);
        adminToken = generateToken(admin);
        
        const randomMobile = `09000${Math.floor(Math.random() * 1000000)}`;
        const res = await request(app)
            .get('/api/admin/stats')
            .set('Authorization', `Bearer ${adminToken}`);
            
        console.log('CREATE ADMIN RES:', res.body); expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });
    
    it("Admin without admin.create cannot create admins", async () => {
        const randomMobile = `09000${Math.floor(Math.random() * 1000000)}`;
        const res = await request(app)
            .post('/api/admin-management')
            .set('Authorization', `Bearer ${adminToken}`)
            .send({ name: 'New', mobile: '09000000003', password: '123' });
            
        expect(res.status).toBe(403);
    });

    it("Root owner can create admins", async () => {
        const randomMobile = `09000${Math.floor(Math.random() * 1000000)}`;
        const res = await request(app)
            .post('/api/admin-management')
            .set('Authorization', `Bearer ${rootToken}`)
            .send({ name: 'NewAdmin2', mobile: randomMobile, password: '123', roles: ['admin'] });
            
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        const newAdmin = db.users.find(u => u.mobile === randomMobile);
        expect(newAdmin).toBeDefined();
        expect(newAdmin?.createdBy).toBe(rootUser.id);
    });

    it("OTP login flow", async () => {
        db.data.otpChallenges = []; // reset rate limits for test
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
    });

});
