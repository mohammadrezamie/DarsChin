import { normalizeIranianMobile } from '../auth/normalize-mobile';

export interface RootIdentityCandidate {
  id: string;
  mobile: string;
}

/**
 * Root privileges belong to the reserved usr-super identity, never to a
 * student who happens to share an operator's configured phone number.
 *
 * Fail closed on collisions. The operator can resolve the configuration and
 * retained user data with an audited, separate repair procedure.
 */
export function resolveBootstrapRoot<T extends RootIdentityCandidate>(
  users: readonly T[],
  configuredMobile: string | undefined,
): T | undefined {
  const existingRoot = users.find(user => user.id === 'usr-super');
  if (!configuredMobile) return existingRoot;

  const mobile = normalizeIranianMobile(configuredMobile);
  if (!/^09\d{9}$/.test(mobile) || mobile !== configuredMobile) {
    throw new Error('ROOT_OWNER_MOBILE must be a canonical Iranian mobile number.');
  }
  if (users.some(user => user.id !== 'usr-super' &&
      normalizeIranianMobile(user.mobile) === mobile)) {
    throw new Error('ROOT_OWNER_MOBILE conflicts with a non-root account; bootstrap refused.');
  }
  return existingRoot;
}
