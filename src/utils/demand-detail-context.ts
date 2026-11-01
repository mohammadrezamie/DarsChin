export type DemandDetailState = 'idle' | 'loading' | 'ready' | 'error';

/** Stable identity for a response or report belonging to exactly one survey revision. */
export function demandDetailKey(
  role: 'student' | 'admin',
  surveyId: string | null | undefined,
  revision: number,
): string | null {
  return surveyId ? JSON.stringify([role, surveyId, revision]) : null;
}

/**
 * A previous survey can still be held in React state for one render before
 * effects run. Never reveal or submit it under a different survey/revision.
 */
export function isCurrentDemandDetail(
  currentKey: string | null,
  settledKey: string | null,
  state: DemandDetailState,
): boolean {
  return Boolean(currentKey && settledKey === currentKey && state === 'ready');
}
