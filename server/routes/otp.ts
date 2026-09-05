import { Router } from 'express';
import { db } from '../db/database';
import { generateToken } from '../middleware/auth';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { NiazpardazSmsClient } from 'niazpardazsms';

export const otpRouter = Router();

// In-memory rate limiting and storage for simplicity (should use DB/Redis in prod, but DB is JSON here)

const OTP_EXPIRY_MS = 2 * 60 * 1000; // 2 minutes
const CAPTCHA_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

otpRouter.get('/captcha/generate', (req, res) => {
    const value = Math.floor(1000 + Math.random() * 9000).toString();
    const id = crypto.randomUUID();
    
    db.captchaChallenges.push({
        id,
        value,
        createdAt: Date.now(),
        expiresAt: Date.now() + CAPTCHA_EXPIRY_MS,
        attempts: 0
    });
    db.save();
    
    // We would render the CAPTCHA to SVG/Base64 here in a real app, but for now we just return the value for simplicity of testing
    // In production, NEVER return the value.
    res.json({ success: true, data: { id, text: value } }); // Mock returning text for testing
});

otpRouter.post('/send', async (req, res) => {
    const { mobile, purpose, captchaId, captchaValue } = req.body;
    
    if (!mobile || !purpose) return res.status(400).json({ success: false, error: 'پارامترهای نامعتبر' });
    
    // Verify CAPTCHA
    const captcha = db.captchaChallenges.find(c => c.id === captchaId);
    if (!captcha || captcha.expiresAt < Date.now() || captcha.consumedAt) {
        return res.status(400).json({ success: false, error: 'کپچای نامعتبر یا منقضی شده.' });
    }
    if (captcha.value !== captchaValue) {
        captcha.attempts++;
        db.save();
        return res.status(400).json({ success: false, error: 'کد امنیتی اشتباه است.' });
    }
    captcha.consumedAt = Date.now();
    
    // Throttle checks
    const recentOtps = db.otpChallenges.filter(o => o.mobile === mobile && o.createdAt > Date.now() - 60000);
    if (recentOtps.length > 0) {
        return res.status(429).json({ success: false, error: 'لطفاً یک دقیقه صبر کنید.' });
    }
    
    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const hashedOtp = bcrypt.hashSync(otpCode, 10);
    const id = crypto.randomUUID();
    
    db.otpChallenges.push({
        id,
        mobile,
        purpose,
        hashedOtp,
        createdAt: Date.now(),
        expiresAt: Date.now() + OTP_EXPIRY_MS,
        attempts: 0
    });
    db.save();
    
    // Attempt to send via Niazpardaz if API Key is set
    const apiKey = process.env.NIAZPARDAZ_API_KEY;
    if (apiKey) {
        try {
            const client = new NiazpardazSmsClient(apiKey);
            const sender = process.env.NIAZPARDAZ_SENDER_NUMBER || '10001234';
            const messageText = `کد ورود به درسچین:\n${otpCode}\n\nاین کد 2 دقیقه اعتبار دارد.`;
            const result = await client.send(sender, mobile, messageText);
            if (result.resultCode !== 0) {
                console.error('[NIAZPARDAZ] Failed to send SMS:', result);
                // We still proceed, but you might want to return an error in production
            }
        } catch (err) {
            console.error('[NIAZPARDAZ] Error:', err);
        }
    } else {
        console.log(`[LOCAL OTP] Code for ${mobile}: ${otpCode}`);
    }
    
    res.json({ success: true, message: 'کد تایید ارسال شد.', data: { challengeId: id, code: otpCode /* for testing */ } });
});

otpRouter.post('/verify', (req, res) => {
    const { challengeId, mobile, code } = req.body;
    
    if (!challengeId || !mobile || !code) return res.status(400).json({ success: false, error: 'پارامترهای نامعتبر' });
    
    const challenge = db.otpChallenges.find(c => c.id === challengeId && c.mobile === mobile);
    if (!challenge || challenge.expiresAt < Date.now() || challenge.consumedAt) {
        return res.status(400).json({ success: false, error: 'کد تایید نامعتبر یا منقضی شده است.' });
    }
    
    if (challenge.attempts >= 5) {
        return res.status(429).json({ success: false, error: 'تعداد دفعات مجاز به پایان رسیده است.' });
    }
    
    if (!bcrypt.compareSync(code.toString(), challenge.hashedOtp)) {
        challenge.attempts++;
        db.save();
        return res.status(400).json({ success: false, error: 'کد تایید اشتباه است.' });
    }
    
    challenge.consumedAt = Date.now();
    db.save();
    
    if (challenge.purpose === 'login') {
        let user = db.users.find(u => u.mobile === mobile);
        if (!user) {
            return res.status(404).json({ success: false, error: 'کاربر یافت نشد.' });
        }
        if (user.deactivatedAt) {
            return res.status(403).json({ success: false, error: 'حساب کاربری غیرفعال است.' });
        }
        
        // Log audit
        db.auditLogs.push({
            id: `log-${Date.now()}`,
            adminId: user.id,
            action: 'USER_LOGIN_OTP',
            entityType: 'USER',
            entityId: user.id,
            details: `ورود با رمز یکبار مصرف: ${mobile}`,
            createdAt: new Date().toISOString()
        });
        db.save();
        
        const token = generateToken({ id: user.id, roles: user.roles, permissions: user.permissions });
        return res.json({
            success: true,
            data: {
                token,
                user: { id: user.id, mobile: user.mobile, name: user.name, roles: user.roles, permissions: user.permissions }
            }
        });
    }
    
    res.json({ success: true, message: 'تایید شد.' });
});
