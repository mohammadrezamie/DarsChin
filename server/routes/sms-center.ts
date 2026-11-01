import { Router } from 'express';
import { z } from 'zod';
import crypto from 'node:crypto';
import { db } from '../db/database';
import { authenticate, requirePermission, type AuthenticatedRequest } from '../middleware/auth';
import { smsConfiguration, smsReadiness, validateSmsTemplate } from '../sms/service';

export const smsCenterRouter = Router();
smsCenterRouter.use(authenticate);
smsCenterRouter.use((req: AuthenticatedRequest, res, next) => {
  if (!req.user?.roles.some(role => role === 'admin' || role === 'super-admin')) {
    return res.status(403).json({ success:false,error:'پنل پیامک فقط برای مدیر مجاز است.' });
  }
  next();
});
smsCenterRouter.use(requirePermission('sms.manage'));
smsCenterRouter.use((_req,res,next)=>{res.setHeader('Cache-Control','private, no-store');next();});

const settingsSchema=z.object({
  mode:z.enum(['log','niazpardaz']),
  senderLine:z.string().trim().max(32).regex(/^[0-9+]*$/),
  otpTemplate:z.string().min(12).max(320),
}).strict();

smsCenterRouter.get('/settings', (_req,res)=>{
  return res.json({success:true,data:{...smsConfiguration(),readiness:smsReadiness()}});
});
smsCenterRouter.put('/settings', (req:AuthenticatedRequest,res)=>{
  const parsed=settingsSchema.safeParse(req.body);
  if (!parsed.success || !validateSmsTemplate(parsed.data?.otpTemplate || '')) {
    return res.status(400).json({success:false,error:'تنظیمات پیامک معتبر نیست؛ قالب باید دقیقاً یک {code} داشته باشد.'});
  }
  const before=smsConfiguration(), after=parsed.data;
  const previousStored = db.data.smsSettings;
  const auditCount = db.auditLogs.length;
  db.data.smsSettings=after;
  db.auditLogs.push({
    id:'sms-config-'+crypto.randomUUID(),adminId:req.user!.id,
    action:'SMS_CENTER_CONFIGURATION_CHANGED',entityType:'SMS',entityId:'configuration',
    // No credentials, OTP, recipient, or message content in audit.
    details:JSON.stringify({from:before.mode,to:after.mode,
      senderChanged:before.senderLine!==after.senderLine,templateChanged:before.otpTemplate!==after.otpTemplate}),
    createdAt:new Date().toISOString(),
  });
  try {
    db.save();
  } catch {
    db.data.smsSettings = previousStored;
    db.auditLogs.splice(auditCount);
    return res.status(503).json({ success:false, error:'تنظیمات پیامک ذخیره نشد.' });
  }
  return res.json({success:true,data:{...smsConfiguration(),readiness:smsReadiness()}});
});
smsCenterRouter.get('/history', (_req,res)=>{
  return res.json({success:true,data:[...(db.data.smsHistory||[])].slice(-200).reverse()});
});
