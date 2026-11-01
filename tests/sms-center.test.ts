import { afterEach, describe, expect, it, vi } from 'vitest';
import { DEFAULT_SMS_CONFIGURATION, smsReadiness, validateSmsTemplate } from '../server/sms/service';
import { browserDemoRequest, resetBrowserDemo } from '../src/demo/mock-api';

afterEach(()=>{resetBrowserDemo();vi.unstubAllEnvs();});

describe('single SMS center',()=>{
  it('starts in no-send mode and requires exactly one code variable',()=>{
    expect(DEFAULT_SMS_CONFIGURATION.mode).toBe('log');
    expect(validateSmsTemplate(DEFAULT_SMS_CONFIGURATION.otpTemplate)).toBe(true);
    expect(validateSmsTemplate('کد ورود به درس چین: {code} و {code}')).toBe(false);
    expect(validateSmsTemplate('کد ورود به درس چین: {other}')).toBe(false);
    expect(validateSmsTemplate('لطفا وارد https://example.org شوید: {code}')).toBe(false);
  });
  it('never declares Niazpardaz ready just because the mode changed',()=>{
    vi.stubEnv('SMS_PROVIDER','niazpardaz');
    vi.stubEnv('NIAZPARDAZ_API_KEY','');
    vi.stubEnv('NIAZPARDAZ_SMS_OTP_APPROVED','false');
    expect(smsReadiness().canDeliver).toBe(false);
  });
  it('supports synthetic administrative configuration without actual SMS sending',async()=>{
    const before=await browserDemoRequest<any>('/api/sms-center/settings');
    expect(before.success).toBe(true);
    expect(before.data?.readiness.canDeliver).toBe(false);
    const saved=await browserDemoRequest<any>('/api/sms-center/settings',{
      method:'PUT',body:JSON.stringify({mode:'niazpardaz',senderLine:'5000249',
        otpTemplate:'کد تأیید درس چین: {code}'}),
    });
    expect(saved.success).toBe(true);
    expect(saved.data?.readiness.canDeliver).toBe(false);
    const log=await browserDemoRequest<any[]>('/api/sms-center/history');
    expect(log.data).toEqual([]);
  });
});
