import { z } from 'zod';
import { normalizeIranianMobile } from '../auth/normalize-mobile';

const iranianMobileSchema = z
  .string()
  .trim()
  .min(1, 'شماره موبایل الزامی است')
  .max(32, 'شماره موبایل نامعتبر است')
  .transform(normalizeIranianMobile)
  .pipe(z.string().regex(/^09\d{9}$/, 'فرمت صحیح: 09123456789'));

export const registerSchema = z.object({
  mobile: iranianMobileSchema,
  password: z.string().min(6, 'رمز عبور باید حداقل ۶ کاراکتر باشد'),
  name: z.string().min(2, 'لطفاً نام و نام خانوادگی خود را وارد کنید'),
  recoveryKey: z.string().optional(),
  captchaToken: z.string().max(2048).optional(),
  otpChallengeId: z.string().max(100).optional(),
  otpCode: z.string().regex(/^\d{6}$/).optional(),
});

export const loginSchema = z.object({
  mobile: iranianMobileSchema,
  password: z.string().min(1, 'رمز عبور الزامی است'),
  captchaToken: z.string().max(2048).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'رمز عبور فعلی الزامی است'),
  newPassword: z.string().min(6, 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد'),
});

export const recoverPasswordSchema = z.object({
  mobile: iranianMobileSchema,
  recoveryKey: z.string().trim().min(1, 'کلید بازیابی الزامی است'),
  newPassword: z.string().min(6, 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد'),
});

/** Request shape used by the OTP-based /recover-password route. */
export const otpPasswordRecoverySchema = z.object({
  mobile: iranianMobileSchema,
  otpChallengeId: z.string().trim().min(1).max(100),
  newPassword: z.string().min(6, 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد'),
});
