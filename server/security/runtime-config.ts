/**
 * Reject unsafe credentials before any production database, HTTP listener or
 * demo/root bootstrap is touched. Public source must not deploy with samples.
 */
function weak(value: string): boolean {
  const normalized = value.toLowerCase().trim();
  return /^(?:changeme|change-me|password|secret|test|example|your[_-]?secret|placeholder|123456|admin)/.test(normalized) ||
    /^(.{1,4})\1{3,}$/.test(value);
}

export function assertRuntimeSecurityConfiguration(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;

  const jwtSecret = env.JWT_SECRET ?? '';
  const rootPassword = env.ROOT_OWNER_PASSWORD ?? '';
  const rootRecovery = env.ROOT_OWNER_RECOVERY_KEY ?? '';

  if (Buffer.byteLength(jwtSecret, 'utf8') < 32 || weak(jwtSecret)) {
    throw new Error('Production JWT_SECRET must be a unique unpredictable secret of at least 32 bytes.');
  }
  if (rootPassword.length < 16 || weak(rootPassword) || rootPassword === jwtSecret) {
    throw new Error('Production ROOT_OWNER_PASSWORD must be a distinct strong secret of at least 16 characters.');
  }
  if (rootRecovery.length < 16 || weak(rootRecovery) ||
      rootRecovery === rootPassword || rootRecovery === jwtSecret) {
    throw new Error('Production ROOT_OWNER_RECOVERY_KEY must be a distinct strong secret of at least 16 characters.');
  }
  if (!/^09\d{9}$/.test(env.ROOT_OWNER_MOBILE || '')) {
    throw new Error('Production ROOT_OWNER_MOBILE must be a canonical 11-digit Iranian mobile.');
  }
  if (env.MOCK_OTP_CODE) {
    throw new Error('Production must never configure MOCK_OTP_CODE.');
  }
}
