import { describe, expect, it } from 'vitest';
import type { OtpChallenge } from '../src/types';
import { canRecoverPasswordWithChallenge, completePasswordRecovery } from '../server/auth/password-recovery';

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

  it('marks a successful recovery as complete and rejects replay', () => {
    const otp = challenge();
    completePasswordRecovery(otp, 175);
    expect(otp.recoveredAt).toBe(175);
    expect(canRecoverPasswordWithChallenge(otp, '09123456789')).toBe(false);
  });
});
