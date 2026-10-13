import { describe, expect, it } from 'vitest';
import type { OtpChallenge } from '../src/types';
import { canRecoverPasswordWithChallenge, completePasswordRecovery } from '../server/auth/password-recovery';
import { recoverPasswordSchema } from '../server/schemas/auth';

function challenge(overrides: Partial<OtpChallenge> = {}): OtpChallenge {
  return {
    id: 'otp-test',
    mobile: '09123456789',
    purpose: 'password_recovery',
    hashedOtp: 'hash',
    createdAt: 100,
    expiresAt: 200,
    attempts: 0,
    consumedAt: 150,
    ...overrides,
  };
}

describe('password recovery challenge', () => {
  it('allows a verified, unconsumed recovery challenge for the matching mobile', () => {
    expect(canRecoverPasswordWithChallenge(challenge(), '09123456789')).toBe(true);
  });

  it('rejects challenges that are missing, unverified, for another mobile, or for another purpose', () => {
    expect(canRecoverPasswordWithChallenge(undefined, '09123456789')).toBe(false);
    expect(canRecoverPasswordWithChallenge(challenge({ consumedAt: undefined }), '09123456789')).toBe(false);
    expect(canRecoverPasswordWithChallenge(challenge(), '09999999999')).toBe(false);
    expect(canRecoverPasswordWithChallenge(challenge({ purpose: 'login' }), '09123456789')).toBe(false);
  });

  it('rejects an expired challenge and accepts one only before its expiry', () => {
    const otp = challenge();
    expect(canRecoverPasswordWithChallenge(otp, '09123456789', 199)).toBe(true);
    expect(canRecoverPasswordWithChallenge(otp, '09123456789', 200)).toBe(false);
    expect(canRecoverPasswordWithChallenge(otp, '09123456789', 201)).toBe(false);
  });

  it('rejects challenges with a missing or invalid expiry timestamp', () => {
    expect(canRecoverPasswordWithChallenge(challenge({ expiresAt: undefined as unknown as number }), '09123456789', 150)).toBe(false);
    expect(canRecoverPasswordWithChallenge(challenge({ expiresAt: Number.NaN }), '09123456789', 150)).toBe(false);
  });

  it('marks a successful recovery as complete and rejects replay', () => {
    const otp = challenge();
    completePasswordRecovery(otp, 175);
    expect(otp.recoveredAt).toBe(175);
    expect(canRecoverPasswordWithChallenge(otp, '09123456789')).toBe(false);
  });
});

describe('password recovery request validation', () => {
  const validRequest = {
    mobile: '09123456789',
    recoveryKey: 'recovery-key',
    newPassword: 'secure-password',
  };

  it('accepts a valid Iranian mobile number', () => {
    expect(recoverPasswordSchema.safeParse(validRequest).success).toBe(true);
  });

  it.each(['', '09123', 'abcdefghijk', '+989123456789', '۰۹۱۲۳۴۵۶۷۸۹'])(
    'rejects malformed mobile number %s',
    (mobile) => {
      expect(recoverPasswordSchema.safeParse({ ...validRequest, mobile }).success).toBe(false);
    },
  );

  it('rejects a missing recovery key and a short new password', () => {
    expect(recoverPasswordSchema.safeParse({ ...validRequest, recoveryKey: '' }).success).toBe(false);
    expect(recoverPasswordSchema.safeParse({ ...validRequest, newPassword: '123' }).success).toBe(false);
  });
});
