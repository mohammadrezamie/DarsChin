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
