import express from 'express';
import request from 'supertest';
import { otpRouter } from './server/routes/otp';
import { db } from './server/db/database';

const app = express();
app.use(express.json());
app.use('/api/auth/otp', otpRouter);

async function run() {
    await db.init(true);
    const captchaRes = await request(app).get('/api/auth/otp/captcha/generate');
    console.log("CAPTCHA RES:", captchaRes.body);
    const captchaId = captchaRes.body.data.id;
    
    const debugRes = await request(app).get(`/api/auth/otp/captcha/debug/${captchaId}`);
    console.log("DEBUG RES:", debugRes.body);
}
run();
