/**
 * Canonical admin workspace identifiers for URL navigation.
 * Never resolve a privileged workspace for a non-super-admin account.
 */
export const ADMIN_TABS = [
  'overview', 'provinces', 'campuses', 'degrees', 'majors', 'tracks',
  'entry-years', 'curricula', 'courses', 'academic-rules', 'terms',
  'offerings', 'academic-settings', 'imports', 'users', 'support',
  'diagnostics', 'logs',
] as const;

export type AdminTab = (typeof ADMIN_TABS)[number];

export const SUPER_ADMIN_TABS: readonly AdminTab[] = [
  'academic-settings', 'users', 'diagnostics', 'logs',
];

export function resolveAdminTab(raw: string | null, isSuperAdmin: boolean): AdminTab {
  if (!raw || !ADMIN_TABS.some((tab) => tab === raw)) return 'overview';
  const tab = raw as AdminTab;
  if (!isSuperAdmin && SUPER_ADMIN_TABS.includes(tab)) return 'overview';
  return tab;
}
