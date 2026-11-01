import type { OtpChallenge } from '../../src/types';

export function canRecoverPasswordWithChallenge(
  challenge: OtpChallenge | undefined,
  mobile: string,
  now = Date.now(),
): challenge is OtpChallenge {
  return Boolean(
    challenge &&
      challenge.mobile === mobile &&
      challenge.purpose === 'password_recovery' &&
      Number.isFinite(challenge.expiresAt) &&
      challenge.expiresAt > now &&
      challenge.consumedAt &&
      !challenge.recoveredAt,
  );
}

export function completePasswordRecovery(challenge: OtpChallenge, now = Date.now()): void {
  challenge.recoveredAt = now;
}
