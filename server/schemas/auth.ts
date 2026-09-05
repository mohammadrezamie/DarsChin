import { z } from 'zod';

export const registerSchema = z.object({
  mobile: z.string().regex(/^09\d{9}$/, 'فرمت صحیح: 09123456789'),
  password: z.string().min(6, 'رمز عبور باید حداقل ۶ کاراکتر باشد'),
  name: z.string().min(2, 'لطفاً نام و نام خانوادگی خود را وارد کنید'),
  recoveryKey: z.string().optional(),
});

export const loginSchema = z.object({
  mobile: z.string().regex(/^09\d{9}$/, 'فرمت صحیح: 09123456789').or(z.string()),
  password: z.string().min(1, 'رمز عبور الزامی است'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'رمز عبور فعلی الزامی است'),
  newPassword: z.string().min(6, 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد'),
});

export const recoverPasswordSchema = z.object({
  mobile: z.string().regex(/^09\d{9}$/, 'فرمت صحیح: 09123456789').or(z.string()),
  recoveryKey: z.string().min(1, 'کلید بازیابی الزامی است'),
  newPassword: z.string().min(6, 'رمز عبور جدید باید حداقل ۶ کاراکتر باشد'),
});
