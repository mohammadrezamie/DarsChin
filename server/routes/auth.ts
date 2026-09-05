// ============================================================================
// DARSCHYN (درس‌چین) - Mobile Number + Password Authentication Routes
// ============================================================================
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db/database';
import { generateToken, AuthenticatedRequest, authenticate } from '../middleware/auth';
import { User, UserRole } from '../../src/types';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema, changePasswordSchema, recoverPasswordSchema } from '../schemas/auth';

export const authRouter = Router();

// Brute-force protection: Rate limit failed logins by mobile number
interface FailedAttempt {
  count: number;
  lockedUntil: number;
}
const failedLogins = new Map<string, FailedAttempt>();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 5 * 60 * 1000; // 5 minutes lockout

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
authRouter.post('/register', validate(registerSchema), (req, res) => {
  
  let { mobile, password, name, recoveryKey } = req.body;
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

  // Check if user already exists
  const existingUser = db.users.find((u) => u.mobile === mobile);
  if (existingUser) {
    return res.status(409).json({
      success: false,
      error: 'حساب کاربری با این شماره موبایل قبلاً ایجاد شده است. لطفاً وارد شوید.',
    });
  }

  // Hash password securely
  const passwordHash = bcrypt.hashSync(password.trim(), 10);
  const userRecoveryKey = recoveryKey?.trim() || `rec-${Math.random().toString(36).substring(2, 10)}`;

  // Determine roles: root mobile gets super-admin automatically; all others get student
  const roles: UserRole[] = mobile === process.env.ROOT_OWNER_MOBILE ? ['super-admin', 'admin', 'student'] : ['student'];

  const newUser: User = {
    id: `usr-${Date.now()}`,
    mobile,
    name: name.trim(),
    password: passwordHash,
    recoveryKey: userRecoveryKey,
    roles,
    createdAt: new Date().toISOString(),
  };

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
    details: `کاربر با شماره موبایل ${mobile} و نقش‌های ${roles.join(', ')} ثبت‌نام کرد.`,
    createdAt: new Date().toISOString(),
  });

  db.save();

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
        recoveryKey: userRecoveryKey,
      },
    },
  });
});

// ----------------------------------------------------------------------------
// 2. LOGIN: Mobile + Password with Brute-Force Rate Limiting
// ----------------------------------------------------------------------------
authRouter.post('/login', validate(loginSchema), (req, res) => {
  
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

  // Find user by mobile
  const user = db.users.find((u) => u.mobile === mobile);
  console.log('Login attempt mobile:', mobile, 'Found user:', user ? user.name : 'null');
  if (user && user.deactivatedAt) {
    return res.status(403).json({
      success: false,
      error: 'حساب کاربری شما غیرفعال شده است.',
    });
  }

  if (!user || !user.password) {
    // Record failed attempt
    const currentCount = (attempt ? attempt.count : 0) + 1;
    const isLocked = currentCount >= MAX_FAILED_ATTEMPTS;
    failedLogins.set(mobile, {
      count: currentCount,
      lockedUntil: isLocked ? now + LOCKOUT_DURATION_MS : 0,
    });

    return res.status(401).json({
      success: false,
      error: 'شماره موبایل یا رمز عبور اشتباه است.',
    });
  }

  // Verify password using bcrypt
  const isMatch = bcrypt.compareSync(password, user.password);
  if (!isMatch) {
    const currentCount = (attempt ? attempt.count : 0) + 1;
    const isLocked = currentCount >= MAX_FAILED_ATTEMPTS;
    failedLogins.set(mobile, {
      count: currentCount,
      lockedUntil: isLocked ? now + LOCKOUT_DURATION_MS : 0,
    });

    return res.status(401).json({
      success: false,
      error: 'شماره موبایل یا رمز عبور اشتباه است.',
      remainingAttempts: Math.max(0, MAX_FAILED_ATTEMPTS - currentCount),
    });
  }

  // Successful login: Reset failed attempts
  failedLogins.delete(mobile);

  // Ensure root super-admin has all roles
  if (user.mobile === process.env.ROOT_OWNER_MOBILE) {
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
    details: `ورود موفق کاربر با شماره موبایل ${user.mobile}`,
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

  // Update password
  user.password = bcrypt.hashSync(newPassword.trim(), 10);

  db.auditLogs.push({
    id: `log-${Date.now()}`,
    adminId: user.id,
    action: 'PASSWORD_CHANGED',
    entityType: 'USER',
    entityId: user.id,
    details: `کاربر ${user.name} رمز عبور خود را تغییر داد.`,
    createdAt: new Date().toISOString(),
  });

  db.save();

  res.json({
    success: true,
    message: 'رمز عبور با موفقیت تغییر یافت.',
  });
});

// ----------------------------------------------------------------------------
// 4. PASSWORD RECOVERY (Local MVP without SMS gateway)
// ----------------------------------------------------------------------------


authRouter.post('/recover-password', (req, res) => {
  let { mobile, newPassword, otpChallengeId } = req.body;
  mobile = normalizeMobile(mobile);
  
  if (!mobile || !newPassword || !otpChallengeId) {
    return res.status(400).json({ success: false, error: 'شماره موبایل، رمز عبور جدید و شناسه تایید الزامی است.' });
  }

  // Check OTP challenge was verified
  const challenge = db.otpChallenges.find(c => c.id === otpChallengeId && c.mobile === mobile);
  if (!challenge || challenge.purpose !== 'password_recovery' || !challenge.consumedAt) {
      return res.status(400).json({ success: false, error: 'فرآیند تایید هویت با کد یکبار مصرف کامل نشده است.' });
  }

  if (newPassword.trim().length < 6) {
    return res.status(400).json({ success: false, error: 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد.' });
  }

  const user = db.users.find((u) => u.mobile === mobile);
  if (!user) {
    return res.status(404).json({ success: false, error: 'کاربری یافت نشد.' });
  }

  user.password = bcrypt.hashSync(newPassword.trim(), 10);
  failedLogins.delete(mobile);

  db.auditLogs.push({
    id: `log-${Date.now()}`,
    adminId: user.id,
    action: 'PASSWORD_RECOVERED',
    entityType: 'USER',
    entityId: user.id,
    details: `رمز عبور کاربر ${user.mobile} با OTP بازیابی شد.`,
    createdAt: new Date().toISOString(),
  });
  db.save();

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
  if (user.mobile === process.env.ROOT_OWNER_MOBILE && !user.roles.includes('super-admin')) {
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
