import type { StudentDestination } from '../components/StudentMobileDock';

/**
 * Student workspaces are URLs, not transient local-only tabs.
 * Browser back/forward and an installed PWA shortcut return to the same view.
 * No student identifiers or private data are placed in the URL.
 */
const destinations: readonly StudentDestination[] = [
  'offerings', 'schedule', 'registration', 'recommendations', 'passed', 'demand', 'support',
];

export function parseStudentWorkspace(value: string | null): StudentDestination {
  return destinations.includes(value as StudentDestination) ? value as StudentDestination : 'offerings';
}

export function studentWorkspaceParams(previous: URLSearchParams, destination: StudentDestination): URLSearchParams {
  const next = new URLSearchParams(previous);
  if (destination === 'offerings') next.delete('tab');
  else next.set('tab', destination);
  return next;
}
