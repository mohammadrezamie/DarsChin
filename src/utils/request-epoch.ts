/**
 * A monotonically increasing request identity: older HTTP responses can never
 * commit after a refresh/retry, role switch, or unmount invalidates them.
 */
export function createRequestEpoch() {
  let epoch = 0;
  return {
    begin(): number { return ++epoch; },
    isCurrent(requestEpoch: number): boolean { return requestEpoch === epoch; },
    invalidate(): void { epoch += 1; },
  };
}
