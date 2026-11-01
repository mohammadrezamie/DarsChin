/**
 * Student destinations are shareable deep links, not hidden local tab state.
 * Keep the parser strict: invalid parameters must never reveal an admin route.
 */
export const STUDENT_WORKSPACE_IDS = [
  'offerings', 'schedule', 'registration', 'recommendations', 'passed', 'demand', 'support',
] as const;

export type StudentWorkspaceId = typeof STUDENT_WORKSPACE_IDS[number];

export function studentWorkspaceFromSearch(search: string): StudentWorkspaceId {
  const requested = new URLSearchParams(search).get('tab');
  return STUDENT_WORKSPACE_IDS.find(id => id === requested) ?? 'offerings';
}

export function studentWorkspaceSearch(tab: StudentWorkspaceId, currentSearch = ''): string {
  const params = new URLSearchParams(currentSearch);
  params.set('tab', tab);
  return '?' + params.toString();
}


/**
 * A survey lookup is separate from the dashboard's academic data request.
 * Do not discard a valid direct /dashboard?tab=demand link before survey
 * availability has been checked for the current signed-in identity.
 * A network error is not evidence that the survey is closed.
 */
export function shouldRedirectClosedDemand(input: {
  tab: StudentWorkspaceId;
  dashboardLoading: boolean;
  currentUserId: string | null;
  checkedUserId: string | null;
  demandChecked: boolean;
  demandFailed: boolean;
  demandAvailable: boolean;
}): boolean {
  return input.tab === 'demand' &&
    !input.dashboardLoading &&
    Boolean(input.currentUserId) &&
    input.currentUserId === input.checkedUserId &&
    input.demandChecked &&
    !input.demandFailed &&
    !input.demandAvailable;
}
