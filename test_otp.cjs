const request = require('supertest');
const express = require('express');
const { otpRouter } = require('./server/routes/otp');
const { db } = require('./server/db/database');

const app = express();
app.use(express.json());
app.use('/api/auth/otp', otpRouter);

(async () => {
    await db.init(true);
    const captchaRes = await request(app).get('/api/auth/otp/captcha/generate');
    console.log(captchaRes.body);
    console.log(captchaRes.status);
})();
