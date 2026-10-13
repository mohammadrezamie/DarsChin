import type { OtpChallenge } from '../../src/types';

export function canRecoverPasswordWithChallenge(
  challenge: OtpChallenge | undefined,
  mobile: string,
): challenge is OtpChallenge {
  return Boolean(
    challenge &&
      challenge.mobile === mobile &&
      challenge.purpose === 'password_recovery' &&
      challenge.consumedAt &&
      !challenge.recoveredAt,
  );
}

export function completePasswordRecovery(challenge: OtpChallenge, now = Date.now()): void {
  challenge.recoveredAt = now;
}
