import crypto from 'node:crypto';
import { NiazpardazSmsClient } from 'niazpardazsms';
import { db } from '../db/database';
import { normalizeIranianMobile } from '../auth/normalize-mobile';

export interface SmsConfiguration {
  mode: 'log' | 'niazpardaz';
  senderLine: string;
  otpTemplate: string;
}
export interface SmsDelivery {
  id: string;
  purpose: 'login' | 'password_recovery';
  recipientMasked: string;
  recipientHash: string;
  provider: SmsConfiguration['mode'];
  status: 'LOGGED' | 'ACCEPTED' | 'FAILED' | 'NOT_CONFIGURED' | 'UNCERTAIN';
  createdAt: string;
  providerResultCode?: number;
}
export const DEFAULT_SMS_CONFIGURATION: SmsConfiguration = {
  mode: 'log',
  senderLine: '',
  otpTemplate: 'کد تأیید درس‌چین: {code}\nاعتبار: ۲ دقیقه',
};
export function validateSmsTemplate(template: string): boolean {
  return template.length >= 12 && template.length <= 320 &&
    (template.match(/\{code\}/g) || []).length === 1 &&
    !/\{(?!code\})[^}]+\}/.test(template) &&
    !/(https?:\/\/|www\.)/i.test(template);
}
export function smsConfiguration(): SmsConfiguration {
  const stored = db.data.smsSettings as SmsConfiguration | undefined;
  const mode = stored?.mode || (process.env.SMS_PROVIDER === 'niazpardaz' ? 'niazpardaz' : 'log');
  return {
    mode: mode === 'niazpardaz' ? 'niazpardaz' : 'log',
    senderLine: stored?.senderLine || process.env.NIAZPARDAZ_SENDER_NUMBER || '',
    otpTemplate: stored?.otpTemplate || DEFAULT_SMS_CONFIGURATION.otpTemplate,
  };
}
export function smsReadiness() {
  const config=smsConfiguration();
  return {
    mode: config.mode,
    senderConfigured: Boolean(config.senderLine),
    apiKeyConfigured: Boolean(process.env.NIAZPARDAZ_API_KEY),
    // Approval is a human/provider step; never infer it from a saved template.
    providerTemplateApproved: process.env.NIAZPARDAZ_SMS_OTP_APPROVED === 'true',
    canDeliver: config.mode === 'niazpardaz' && Boolean(
      process.env.NIAZPARDAZ_API_KEY && config.senderLine &&
      process.env.NIAZPARDAZ_SMS_OTP_APPROVED === 'true' &&
      validateSmsTemplate(config.otpTemplate)
    ),
    logMode: config.mode === 'log',
  };
}
const maskPhone = (mobile: string) => mobile.replace(/^(09\d{2})\d{4}(\d{3})$/, '$1****$2');
export function recordSmsDelivery(data: Omit<SmsDelivery,'id'|'createdAt'|'recipientMasked'|'recipientHash'> & {recipient:string}) {
  const mobile=normalizeIranianMobile(data.recipient);
  const { recipient, ...safe }=data;
  const item:SmsDelivery={
    ...safe,id:'sms-'+crypto.randomUUID(),createdAt:new Date().toISOString(),
    recipientMasked:maskPhone(mobile),recipientHash:crypto.createHash('sha256').update(mobile).digest('hex'),
  };
  db.data.smsHistory ||= [];
  db.data.smsHistory.push(item);
  // Single-process pilot guard: keep a bounded, metadata-only history.
  if (db.data.smsHistory.length>5000) db.data.smsHistory.splice(0,db.data.smsHistory.length-5000);
  db.save();
  return item;
}
export async function sendOtpSms(mobile: string, code: string, purpose:'login'|'password_recovery') {
  const cfg=smsConfiguration();
  const ready=smsReadiness();
  const normalized=normalizeIranianMobile(mobile);
  if (!/^09\d{9}$/.test(normalized) || !/^\d{6}$/.test(code)) {
    throw new Error('INVALID_OTP_SMS_INPUT');
  }
  if (!validateSmsTemplate(cfg.otpTemplate)) throw new Error('INVALID_SMS_TEMPLATE');
  // Always use only an approved template for live delivery.
  if (cfg.mode === 'log') {
    recordSmsDelivery({recipient:normalized,purpose,provider:cfg.mode,status:'LOGGED'});
    if (process.env.NODE_ENV === 'production') throw new Error('SMS_LOG_MODE_NO_DELIVERY');
    return { mode:'log' as const };
  }
  if (!ready.canDeliver) {
    recordSmsDelivery({recipient:normalized,purpose,provider:cfg.mode,status:'NOT_CONFIGURED'});
    throw new Error('SMS_NOT_CONFIGURED');
  }
  const message=cfg.otpTemplate.replace('{code}',code);
  try {
    const client=new NiazpardazSmsClient(process.env.NIAZPARDAZ_API_KEY!);
    const result=await client.send(cfg.senderLine,normalized,message);
    if (result.resultCode !== 0) {
      recordSmsDelivery({recipient:normalized,purpose,provider:cfg.mode,status:'FAILED',
        providerResultCode:typeof result.resultCode==='number'?result.resultCode:undefined});
      throw new Error('SMS_PROVIDER_REJECTED');
    }
    recordSmsDelivery({recipient:normalized,purpose,provider:cfg.mode,status:'ACCEPTED'});
    return {mode:'niazpardaz' as const};
  } catch(error) {
    // Unknown network outcome can mean delivered or not. Do not retry blindly.
    if (error instanceof Error && error.message === 'SMS_PROVIDER_REJECTED') throw error;
    recordSmsDelivery({recipient:normalized,purpose,provider:cfg.mode,status:'UNCERTAIN'});
    throw new Error('SMS_PROVIDER_UNAVAILABLE');
  }
}
