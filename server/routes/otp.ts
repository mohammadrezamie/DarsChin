import { Router } from 'express';
import { db } from '../db/database';
import { generateToken } from '../middleware/auth';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { NiazpardazSmsClient } from 'niazpardazsms';
import svgCaptcha from 'svg-captcha';
import { normalizeIranianMobile } from '../auth/normalize-mobile';
import { validateGuestChallenge } from '../security/turnstile';

export const otpRouter = Router();

const OTP_EXPIRY_MS = 2 * 60 * 1000; // 2 minutes
const CAPTCHA_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Keep short-lived verification state bounded in the JSON database.
 * Expired challenges and consumed challenges outside the password-reset handoff are removable.
 */
function pruneExpiredChallenges(now = Date.now()): boolean {
    const captchaCount = db.captchaChallenges.length;
    const otpCount = db.otpChallenges.length;

    for (let index = db.captchaChallenges.length - 1; index >= 0; index -= 1) {
        const challenge = db.captchaChallenges[index];
        if (!Number.isFinite(challenge.expiresAt) || challenge.expiresAt <= now || challenge.consumedAt) {
            db.captchaChallenges.splice(index, 1);
        }
    }
    for (let index = db.otpChallenges.length - 1; index >= 0; index -= 1) {
        const challenge = db.otpChallenges[index];
        // A verified password-recovery OTP must remain available until the password reset
        // consumes it via recoveredAt; pruning it here would make recovery impossible.
        if (
            !Number.isFinite(challenge.expiresAt) ||
            challenge.expiresAt <= now ||
            (challenge.consumedAt && (challenge.purpose !== 'password_recovery' || challenge.recoveredAt))
        ) db.otpChallenges.splice(index, 1);
    }

    return captchaCount !== db.captchaChallenges.length || otpCount !== db.otpChallenges.length;
}

otpRouter.get('/captcha/generate', (req, res) => {
    pruneExpiredChallenges();
    const captcha = svgCaptcha.create({
        size: 5,
        ignoreChars: '0o1i',
        noise: 2,
        color: true,
        background: '#f4f4f4'
    });
    const id = crypto.randomUUID();
    
    db.captchaChallenges.push({
        id,
        value: captcha.text, // Kept server-side
        createdAt: Date.now(),
        expiresAt: Date.now() + CAPTCHA_EXPIRY_MS,
        attempts: 0
    });
    db.save();
    
    // Only return the challenge ID and the SVG representation
    res.json({ success: true, data: { id, svg: captcha.data } }); 
});

// For testing purposes ONLY: expose CAPTCHA answer if in test environment
if (process.env.NODE_ENV === 'test') {
    otpRouter.get('/captcha/debug/:id', (req, res) => {
        const captcha = db.captchaChallenges.find(c => c.id === req.params.id);
        res.json({ text: captcha?.value });
    });
    otpRouter.get('/debug/:challengeId', (req, res) => {
        const otp = db.otpChallenges.find(o => o.id === req.params.challengeId);
        // Can't return raw OTP easily because it's hashed, but we can intercept it earlier or just use a fixed OTP in test.
        // We'll handle this in tests differently.
        res.json({ hashed: otp?.hashedOtp });
    });
}

function isSupportedOtpPurpose(value: unknown): value is 'login' | 'password_recovery' {
    return value === 'login' || value === 'password_recovery';
}

otpRouter.post('/send', async (req, res) => {
    if (pruneExpiredChallenges()) db.save();
    const body = req.body ?? {};
    let { mobile, purpose, captchaId, captchaValue, captchaToken } = body;
    const usingTurnstile = process.env.TURNSTILE_ENABLED === 'true';

    if (
        typeof mobile !== 'string' ||
        typeof purpose !== 'string' ||
        !isSupportedOtpPurpose(purpose) ||
        (!usingTurnstile && (typeof captchaId !== 'string' || !captchaId.trim() ||
          typeof captchaValue !== 'string' || !captchaValue.trim()))
    ) {
        return res.status(400).json({ success: false, error: 'پارامترهای نامعتبر' });
    }

    mobile = normalizeIranianMobile(mobile);
    if (!/^09\d{9}$/.test(mobile)) {
        return res.status(400).json({ success: false, error: 'شماره موبایل نامعتبر است.' });
    }
    
    // Either provider-verified Turnstile or the legacy local image challenge.
    if (usingTurnstile && !(await validateGuestChallenge(captchaToken, 'otp'))) {
      return res.status(403).json({ success: false, error: 'تأیید «من ربات نیستم» ناموفق بود.' });
    }
    if (!usingTurnstile) {
    const captcha = db.captchaChallenges.find(c => c.id === captchaId);
    if (!captcha || captcha.expiresAt <= Date.now() || captcha.consumedAt) {
        return res.status(400).json({ success: false, error: 'کپچای نامعتبر یا منقضی شده.' });
    }
    
    if (captcha.attempts >= 5) {
         return res.status(429).json({ success: false, error: 'تعداد مجاز تلاش برای این کپچا به پایان رسیده است.' });
    }
    
    if (captcha.value.toLowerCase() !== captchaValue.toLowerCase()) {
        captcha.attempts++;
        db.save();
        return res.status(400).json({ success: false, error: 'کد امنیتی اشتباه است.' });
    }
    
    // Consume CAPTCHA
    captcha.consumedAt = Date.now();
    db.save();
    }

    // Verify user state before sending SMS
    if (purpose === 'login' || purpose === 'password_recovery') {
        const user = db.users.find(u => normalizeIranianMobile(u.mobile) === mobile);
        if (!user) {
            return res.status(404).json({ success: false, error: 'کاربری با این شماره یافت نشد.' });
        }
        if (user.deactivatedAt) {
            return res.status(403).json({ success: false, error: 'حساب کاربری شما غیرفعال است.' });
        }
    }
    
    // Throttle checks
    const recentOtps = db.otpChallenges.filter(o => o.mobile === mobile && o.createdAt > Date.now() - 60000);
    if (recentOtps.length > 0) {
        return res.status(429).json({ success: false, error: 'لطفاً یک دقیقه صبر کنید.' });
    }
    
    const otpCode = crypto.randomInt(100000, 1000000).toString();
    const hashedOtp = bcrypt.hashSync(otpCode, 10);
    const id = crypto.randomUUID();
    
    // Test mode fixed OTP override
    let finalOtp = otpCode;
    if (process.env.NODE_ENV === 'test' && process.env.MOCK_OTP_CODE) {
         finalOtp = process.env.MOCK_OTP_CODE;
         // Override hash to match the mock
         db.otpChallenges.push({
            id, mobile, purpose,
            hashedOtp: bcrypt.hashSync(finalOtp, 10),
            createdAt: Date.now(), expiresAt: Date.now() + OTP_EXPIRY_MS, attempts: 0
         });
    } else {
         db.otpChallenges.push({
            id, mobile, purpose, hashedOtp,
            createdAt: Date.now(), expiresAt: Date.now() + OTP_EXPIRY_MS, attempts: 0
         });
    }
    db.save();
    
    const apiKey = process.env.NIAZPARDAZ_API_KEY;
    if (apiKey) {
        try {
            const client = new NiazpardazSmsClient(apiKey);
            const sender = process.env.NIAZPARDAZ_SENDER_NUMBER || '5000249';
            const messageText = `کد ورود به درس‌چین:\n${finalOtp}\n\nاین کد 2 دقیقه اعتبار دارد.`;
            const result = await client.send(sender, mobile, messageText);
            
            if (result.resultCode !== 0) {
                console.error('[NIAZPARDAZ] Failed to send SMS:', result);
                return res.status(500).json({ success: false, error: 'خطا در ارسال پیامک' });
            }
        } catch (err) {
            console.error('[NIAZPARDAZ] Error:', err);
            return res.status(500).json({ success: false, error: 'خطا در ارتباط با سرویس پیامک' });
        }
    } else {
        if (process.env.NODE_ENV !== 'production') {
            console.log(`[LOCAL OTP] Code for ${mobile}: ${finalOtp}`);
        } else {
            return res.status(500).json({ success: false, error: 'سرویس پیامک تنظیم نشده است' });
        }
    }
    
    // Do NOT return the OTP code
    res.json({ success: true, message: 'کد تایید ارسال شد.', data: { challengeId: id } });
});

otpRouter.post('/verify', (req, res) => {
    if (pruneExpiredChallenges()) db.save();
    const body = req.body ?? {};
    let { challengeId, mobile, code, purpose } = body;

    if (
        typeof challengeId !== 'string' ||
        !challengeId.trim() ||
        typeof mobile !== 'string' ||
        typeof purpose !== 'string' ||
        !isSupportedOtpPurpose(purpose) ||
        (typeof code !== 'string' && typeof code !== 'number')
    ) {
        return res.status(400).json({ success: false, error: 'پارامترهای نامعتبر' });
    }

    mobile = normalizeIranianMobile(mobile);
    if (!/^09\d{9}$/.test(mobile) || !/^\d{6}$/.test(String(code))) {
        return res.status(400).json({ success: false, error: 'شماره موبایل یا کد تایید نامعتبر است.' });
    }
    
    const challenge = db.otpChallenges.find(c => c.id === challengeId && c.mobile === mobile);
    if (!challenge || challenge.expiresAt <= Date.now() || challenge.consumedAt) {
        return res.status(400).json({ success: false, error: 'کد تایید نامعتبر یا منقضی شده است.' });
    }
    
    if (challenge.purpose !== purpose) {
         return res.status(400).json({ success: false, error: 'هدف کد تایید با درخواست همخوانی ندارد.' });
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
        let user = db.users.find(u => normalizeIranianMobile(u.mobile) === mobile);
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
            details: `ورود با رمز یکبار مصرف`,
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
