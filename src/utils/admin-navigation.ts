/** True only for the globally authorized admin or the specifically scoped demand manager. */
export function adminWorkspaceAccess(user: {
  roles: string[];
  permissions?: string[];
  demandScopes?: {campusId:string;degreeLevelId:string;majorId:string}[];
} | null | undefined) {
  const isSuperAdmin = Boolean(user?.roles.includes('super-admin'));
  const hasFullPanel = isSuperAdmin || Boolean(user?.roles.includes('admin') &&
    user?.permissions?.includes('admin.panel.access'));
  const demandOnly = !hasFullPanel && Boolean(
    user?.roles.includes('admin') &&
    user?.permissions?.includes('demand.manage') &&
    user?.demandScopes?.length
  );
  return { isSuperAdmin, hasFullPanel, demandOnly, isAdmin: hasFullPanel || demandOnly };
}

/**
 * Canonical admin workspace identifiers for URL navigation.
 * Never resolve a privileged workspace for a non-super-admin account.
 */
export const ADMIN_TABS = [
  'overview', 'provinces', 'campuses', 'degrees', 'majors', 'tracks',
  'entry-years', 'curricula', 'courses', 'academic-rules', 'terms',
  'offerings', 'academic-settings', 'imports', 'demand', 'users', 'support',
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
