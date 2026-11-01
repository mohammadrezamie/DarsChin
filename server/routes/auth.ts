// ============================================================================
// DARSCHYN (درس‌چین) - Mobile Number + Password Authentication Routes
// ============================================================================
import { Router } from 'express';
import { randomBytes, randomUUID } from 'node:crypto';
import { requireGuestChallenge } from '../security/turnstile';
import bcrypt from 'bcryptjs';
import { db } from '../db/database';
import { generateToken, AuthenticatedRequest, authenticate } from '../middleware/auth';
import { User, UserRole } from '../../src/types';
import { canRecoverPasswordWithChallenge, completePasswordRecovery } from '../auth/password-recovery';
import { smsReadiness } from '../sms/service';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema, changePasswordSchema, otpPasswordRecoverySchema } from '../schemas/auth';
import { FailedLoginTracker } from '../security/login-attempts';

export const authRouter = Router();

// Per-mobile lockout, with bounded in-memory state for public servers.
const failedLogins = new FailedLoginTracker();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes lockout
// Run bcrypt even for unknown/deactivated accounts. Never authenticate this dummy.
const UNKNOWN_LOGIN_PASSWORD_HASH = bcrypt.hashSync('darschin-nonexistent-account-sentinel', 10);
const BAD_LOGIN_RESPONSE = { success: false, error: 'شماره موبایل یا رمز عبور اشتباه است.' } as const;

// Normalize mobile phone numbers (converting Persian/Arabic numerals and international prefixes)
function normalizeMobile(mobile: string): string {
  if (!mobile) return '';
  let cleaned = mobile.trim();
  const persianDigits = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
  const arabicDigits = [/٠/g, /١/g, /٢/g, /٣/g, /٤/g, /٥/g, /٦/g, /٧/g, /٨/g, /٩/g];
  const englishDigits = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

  for (let i = 0; i < 10; i++) {
    cleaned = cleaned.replace(persianDigits[i], englishDigits[i]);
    cleaned = cleaned.replace(arabicDigits[i], englishDigits[i]);
  }

  cleaned = cleaned.replace(/[\s\-_]/g, '');

  if (cleaned.startsWith('+98')) cleaned = '0' + cleaned.substring(3);
  if (cleaned.startsWith('0098')) cleaned = '0' + cleaned.substring(4);
  if (cleaned.startsWith('98') && cleaned.length === 12) cleaned = '0' + cleaned.substring(2);

  return cleaned;
}



// ----------------------------------------------------------------------------
// 1. REGISTER: Mobile + Password (+ Name & Optional Recovery Key)
// ----------------------------------------------------------------------------
authRouter.post('/register', requireGuestChallenge('register'), validate(registerSchema), (req, res) => {
  
  let { mobile, password, name, recoveryKey, otpChallengeId, otpCode } = req.body;
  mobile = normalizeMobile(mobile);

  if (!mobile || !/^09\d{9}$/.test(mobile)) {
    return res.status(400).json({
      success: false,
      error: 'شماره موبایل نامعتبر است. فرمت صحیح: 09123456789 (۱۱ رقم با پیش‌شماره 09)',
    });
  }

  if (!password || password.trim().length < 6) {
    return res.status(400).json({
      success: false,
      error: 'رمز عبور باید حداقل شامل ۶ کاراکتر باشد.',
    });
  }

  if (!name || name.trim().length < 2) {
    return res.status(400).json({
      success: false,
      error: 'لطفاً نام و نام خانوادگی خود را وارد کنید.',
    });
  }

  // Public production accounts must prove phone ownership before creation.
  // Keep the service online while declining unsafe registration when SMS
  // verification has not been activated; existing logins remain unaffected.
  if (process.env.NODE_ENV === 'production' &&
      process.env.DARSCHYN_REGISTRATION_OTP_REQUIRED !== 'true') {
    return res.status(503).json({
      success: false,
      error: 'ثبت‌نام تا فعال‌سازی تأیید شمارهٔ موبایل غیرفعال است.',
    });
  }

  // Check if user already exists
  const existingUser = db.users.find((u) => u.mobile === mobile);
  if (existingUser) {
    return res.status(409).json({
      success: false,
      error: 'حساب کاربری با این شماره موبایل قبلاً ایجاد شده است. لطفاً وارد شوید.',
    });
  }

  // During verified-registration rollout, a CAPTCHA alone is insufficient:
  // an attacker must not claim someone else's mobile without receiving SMS.
  const otpRequired = process.env.DARSCHYN_REGISTRATION_OTP_REQUIRED === 'true';
  let verifiedRegistrationOtp: (typeof db.otpChallenges)[number] | undefined;
  if (otpRequired) {
    if (process.env.NODE_ENV === 'production' && !smsReadiness().canDeliver) {
      return res.status(503).json({ success: false, error: 'ثبت‌نام پیامکی هنوز روی سرور فعال نشده است.' });
    }
    if (typeof otpChallengeId !== 'string' || typeof otpCode !== 'string' || !/^\d{6}$/.test(otpCode)) {
      return res.status(400).json({ success: false, error: 'کد شش‌رقمی تأیید شماره موبایل الزامی است.' });
    }
    verifiedRegistrationOtp = db.otpChallenges.find(item =>
      item.id === otpChallengeId && item.mobile === mobile && item.purpose === 'registration');
    if (!verifiedRegistrationOtp || verifiedRegistrationOtp.expiresAt <= Date.now() ||
        verifiedRegistrationOtp.consumedAt) {
      return res.status(403).json({ success: false, error: 'کد ثبت‌نام نامعتبر یا منقضی شده است.' });
    }
    if (verifiedRegistrationOtp.attempts >= 5) {
      return res.status(429).json({ success: false, error: 'تعداد تلاش برای کد تأیید به پایان رسیده است.' });
    }
    if (!bcrypt.compareSync(otpCode, verifiedRegistrationOtp.hashedOtp)) {
      verifiedRegistrationOtp.attempts += 1;
      db.save();
      return res.status(403).json({ success: false, error: 'کد تأیید شماره موبایل اشتباه است.' });
    }
  }

  // Hash password securely
  const passwordHash = bcrypt.hashSync(password.trim(), 10);
  const userRecoveryKey = recoveryKey?.trim() || `rec-${randomBytes(24).toString('base64url')}`;

  // Public registration always creates a student. Root privileges are assigned only by trusted bootstrap.
  const roles: UserRole[] = ['student'];

  const newUser: User = {
    id: `usr-${randomUUID()}`,
    mobile,
    name: name.trim(),
    password: passwordHash,
    // Recovery material is never persisted in clear text.
    recoveryKey: bcrypt.hashSync(userRecoveryKey, 10),
    roles,
    ...(otpRequired ? { mobileVerifiedAt: new Date().toISOString() } : {}),
    createdAt: new Date().toISOString(),
  };

  // Never commit the verified OTP separately before saving the new account.
  // A retry cannot claim the same verified mobile with the same challenge.
  const previousOtpConsumedAt = verifiedRegistrationOtp?.consumedAt;
  const userCount = db.users.length;
  const profileCount = db.studentProfiles.length;
  const auditCount = db.auditLogs.length;
  if (verifiedRegistrationOtp) verifiedRegistrationOtp.consumedAt = Date.now();
  db.users.push(newUser);

  // Automatically initialize student academic profile
  if (roles.includes('student')) {
    db.studentProfiles.push({
      userId: newUser.id,
      universityId: db.universities[0]?.id || 'univ-azad',
      campusId: db.campuses[0]?.id || 'camp-srbiau',
      degreeLevelId: db.degreeLevels[0]?.id || 'deg-bs',
      majorId: db.majors[0]?.id || 'maj-computer',
      entryYearId: db.entryYears.find((y) => y.year === 1403)?.id || db.entryYears[0]?.id || 'ey-1403',
      isTrackSelected: false,
      selectedTrackId: null,
      desiredTrackIds: [],
      currentTermId: db.academicTerms.find((t) => t.isCurrent)?.id || db.academicTerms[0]?.id || 'term-1405-1',
      previousTermGpa: null,
      updatedAt: new Date().toISOString(),
    });
  }

  // Log audit event
  db.auditLogs.push({
    id: `log-${Date.now()}`,
    adminId: newUser.id,
    action: 'USER_REGISTERED',
    entityType: 'USER',
    entityId: newUser.id,
    details: 'حساب دانشجو ایجاد شد.',
    createdAt: new Date().toISOString(),
  });

  try {
    db.save();
  } catch {
    // Failed disk writes must not leave a phantom account or consume its OTP.
    db.users.splice(userCount);
    db.studentProfiles.splice(profileCount);
    db.auditLogs.splice(auditCount);
    if (verifiedRegistrationOtp) verifiedRegistrationOtp.consumedAt = previousOtpConsumedAt;
    return res.status(500).json({ success: false, error: 'ثبت‌نام ذخیره نشد؛ لطفاً دوباره تلاش کنید.' });
  }

  // Issue JWT Token
  const token = generateToken({ id: newUser.id, roles: newUser.roles });

  res.status(201).json({
    success: true,
    message: 'ثبت‌نام با موفقیت انجام شد.',
    data: {
      token,
      user: {
        id: newUser.id,
        mobile: newUser.mobile,
        name: newUser.name,
        roles: newUser.roles,
      },
    },
  });
});

// ----------------------------------------------------------------------------
// 2. LOGIN: Mobile + Password with Brute-Force Rate Limiting
// ----------------------------------------------------------------------------
authRouter.post('/login', requireGuestChallenge('login'), validate(loginSchema), (req, res) => {
  
  let { mobile, password } = req.body;
  mobile = normalizeMobile(mobile);

  if (!mobile || !password) {
    return res.status(400).json({
      success: false,
      error: 'شماره موبایل و رمز عبور الزامی است.',
    });
  }

  // Check brute-force lockout status
  const attempt = failedLogins.get(mobile);
  const now = Date.now();
  if (attempt && attempt.lockedUntil > now) {
    const remainingSeconds = Math.ceil((attempt.lockedUntil - now) / 1000);
    const minutes = Math.ceil(remainingSeconds / 60);
    return res.status(429).json({
      success: false,
      error: `تعداد تلاش‌های ناموفق بیش از حد مجاز بوده است. حساب شما به مدت ${minutes} دقیقه قفل است.`,
      lockedRemainingSeconds: remainingSeconds,
    });
  }

  // Do not disclose if the mobile exists or was deactivated. Return the
  // same status/body and apply the same lockout counter in all three cases.
  const user = db.users.find((u) => u.mobile === mobile);
  const validPassword = bcrypt.compareSync(password,
    user && !user.deactivatedAt && user.password ? user.password : UNKNOWN_LOGIN_PASSWORD_HASH);
  if (!user || user.deactivatedAt || !user.password || !validPassword) {
    const currentCount = (attempt ? attempt.count : 0) + 1;
    failedLogins.set(mobile, {
      count: currentCount,
      lockedUntil: currentCount >= MAX_FAILED_ATTEMPTS ? now + LOCKOUT_DURATION_MS : 0,
    });
    return res.status(401).json(BAD_LOGIN_RESPONSE);
  }

  // Successful login: Reset failed attempts
  failedLogins.delete(mobile);

  // Ensure root super-admin has all roles
  if (user.id === 'usr-super' && user.mobile === process.env.ROOT_OWNER_MOBILE) {
    if (!Array.isArray(user.roles)) user.roles = user.roles ? [(user.roles as any)] : [];
    if (!user.roles.includes('super-admin')) user.roles.push('super-admin');
    if (!user.roles.includes('admin')) user.roles.push('admin');
    if (!user.roles.includes('student')) user.roles.push('student');
    db.save();
  }

  // Log audit event
  db.auditLogs.push({
    id: `log-${Date.now()}`,
    adminId: user.id,
    action: 'USER_LOGIN',
    entityType: 'USER',
    entityId: user.id,
    details: 'ورود موفق حساب کاربری.',
    createdAt: new Date().toISOString(),
  });
  db.save();

  // Generate JWT Token
  const token = generateToken({ id: user.id, roles: user.roles, permissions: user.permissions });

  res.json({
    success: true,
    message: 'ورود با موفقیت انجام شد.',
    data: {
      token,
      user: {
        id: user.id,
        mobile: user.mobile,
        name: user.name,
        roles: user.roles,
      permissions: user.permissions || [],
      },
    },
  });
});

// ----------------------------------------------------------------------------
// 3. CHANGE PASSWORD (Authenticated)
// ----------------------------------------------------------------------------
authRouter.post('/change-password', authenticate, validate(changePasswordSchema), (req: AuthenticatedRequest, res) => {
  const userId = req.user?.id;
  const { currentPassword, newPassword } = req.body;

  if (!userId) {
    return res.status(401).json({ success: false, error: 'احراز هویت الزامی است.' });
  }

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ success: false, error: 'رمز عبور فعلی و رمز عبور جدید الزامی هستند.' });
  }

  if (newPassword.trim().length < 6) {
    return res.status(400).json({ success: false, error: 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد.' });
  }

  const user = db.users.find((u) => u.id === userId);
  if (!user || !user.password) {
    return res.status(404).json({ success: false, error: 'کاربر یافت نشد.' });
  }

  const isMatch = bcrypt.compareSync(currentPassword, user.password);
  if (!isMatch) {
    return res.status(400).json({ success: false, error: 'رمز عبور فعلی نادرست است.' });
  }

  // Invalidate every older JWT, including leaked tokens from other devices.
  // The current browser receives a newly signed JWT after persistence.
  const previousPassword = user.password;
  const previousSessionVersion = user.sessionVersion;
  const auditCount = db.auditLogs.length;
  user.password = bcrypt.hashSync(newPassword.trim(), 10);
  user.sessionVersion = (user.sessionVersion ?? 0) + 1;

  db.auditLogs.push({
    id: `log-${randomUUID()}`,
    adminId: user.id,
    action: 'PASSWORD_CHANGED',
    entityType: 'USER',
    entityId: user.id,
    details: 'رمز عبور حساب تغییر کرد.',
    createdAt: new Date().toISOString(),
  });

  try {
    db.save();
  } catch {
    user.password = previousPassword;
    user.sessionVersion = previousSessionVersion;
    db.auditLogs.splice(auditCount);
    return res.status(500).json({ success: false, error: 'تغییر رمز عبور ذخیره نشد؛ لطفاً دوباره تلاش کنید.' });
  }

  res.json({
    success: true,
    message: 'رمز عبور با موفقیت تغییر یافت. نشست‌های قبلی بسته شدند.',
    data: { token: generateToken(user) },
  });
});

// ----------------------------------------------------------------------------
// 4. PASSWORD RECOVERY (Local MVP without SMS gateway)
// ----------------------------------------------------------------------------


authRouter.post('/recover-password', validate(otpPasswordRecoverySchema), (req, res) => {
  let { mobile, newPassword, otpChallengeId } = req.body;
  mobile = normalizeMobile(mobile);
  
  if (!mobile || !newPassword || !otpChallengeId) {
    return res.status(400).json({ success: false, error: 'شماره موبایل، رمز عبور جدید و شناسه تایید الزامی است.' });
  }

  // Check OTP challenge was verified
  const challenge = db.otpChallenges.find(c => c.id === otpChallengeId && c.mobile === mobile);
  if (!canRecoverPasswordWithChallenge(challenge, mobile)) {
      return res.status(400).json({ success: false, error: 'فرآیند تایید هویت با کد یکبار مصرف کامل نشده است.' });
  }

  if (newPassword.trim().length < 6) {
    return res.status(400).json({ success: false, error: 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد.' });
  }

  const user = db.users.find((u) => normalizeMobile(u.mobile) === mobile);
  if (!user) {
    return res.status(404).json({ success: false, error: 'کاربری یافت نشد.' });
  }
  if (user.deactivatedAt) {
    return res.status(403).json({ success: false, error: 'حساب کاربری شما غیرفعال شده است.' });
  }

  const previousPassword = user.password;
  const previousSessionVersion = user.sessionVersion;
  const previousRecoveredAt = challenge.recoveredAt;
  const auditCount = db.auditLogs.length;
  user.password = bcrypt.hashSync(newPassword.trim(), 10);
  // OTP recovery must revoke JWTs issued before the reset, not just passwords.
  user.sessionVersion = (user.sessionVersion ?? 0) + 1;
  // Consume OTP, credential and audit together in one durable JSON write.
  completePasswordRecovery(challenge);

  db.auditLogs.push({
    id: `log-${randomUUID()}`,
    adminId: user.id,
    action: 'PASSWORD_RECOVERED',
    entityType: 'USER',
    entityId: user.id,
    details: 'رمز عبور حساب با OTP بازنشانی شد.',
    createdAt: new Date().toISOString(),
  });
  try {
    db.save();
  } catch {
    user.password = previousPassword;
    user.sessionVersion = previousSessionVersion;
    challenge.recoveredAt = previousRecoveredAt;
    db.auditLogs.splice(auditCount);
    return res.status(500).json({ success: false, error: 'بازیابی رمز عبور ذخیره نشد؛ لطفاً دوباره تلاش کنید.' });
  }
  // A failed save must not unlock guessed passwords or consume the OTP in memory.
  failedLogins.delete(mobile);

  res.json({ success: true, message: 'رمز عبور شما با موفقیت بازنشانی شد.' });
});

// ----------------------------------------------------------------------------
// 6. GET CURRENT USER (/api/auth/me)
// ----------------------------------------------------------------------------
authRouter.get('/me', authenticate, (req: AuthenticatedRequest, res) => {
  const user = db.users.find((u) => u.id === req.user?.id);
  if (!user) {
    return res.status(404).json({ success: false, error: 'کاربر یافت نشد.' });
  }

  // Auto-upgrade permissions if super-admin hardcoded matches
  if (user.id === 'usr-super' && user.mobile === process.env.ROOT_OWNER_MOBILE && !user.roles.includes('super-admin')) {
    if (!Array.isArray(user.roles)) user.roles = user.roles ? [(user.roles as any)] : [];
    user.roles.push('super-admin');
    if (!user.roles.includes('admin')) user.roles.push('admin');
    db.save();
  }

  const refreshedToken = generateToken({ id: user.id, roles: user.roles, permissions: user.permissions, mobile: user.mobile, name: user.name });
  res.json({
    success: true,
    data: {
      token: refreshedToken,

      id: user.id,
      mobile: user.mobile,
      name: user.name,
      roles: user.roles,
    },
  });
});

// ----------------------------------------------------------------------------
// 7. LOGOUT (/api/auth/logout)
// ----------------------------------------------------------------------------
authRouter.post('/logout', authenticate, (req: AuthenticatedRequest, res) => {
  res.json({ success: true, message: 'با موفقیت از حساب کاربری خارج شدید.' });
});

export default authRouter;
