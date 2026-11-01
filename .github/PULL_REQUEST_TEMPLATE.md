## Required security review

- [ ] Read [Permanent Security Policy](../../docs/PERMANENT_SECURITY_POLICY_FA.md) and [Security Policy](../../SECURITY.md)
- [ ] Checked public-source/secret exposure and considered historical PR refs; no real PII or credentials in commits, logs, screenshots or tests
- [ ] Reviewed server-side authentication, identity ownership, authorization scopes, privacy/no-store and hostile inputs
- [ ] Reviewed failed-write rollback, audit integrity, seed/demo isolation, dependency and supply-chain risks
- [ ] Added negative HTTP/regression tests for security-sensitive changes, with exact SHA and result
- [ ] Confirmed production, existing server, TNA and credentials untouched unless separately authorized

## Summary

Describe the change and the behavior it affects.

## Scope

- [ ] No academic policy change (or owner approval is linked below)
- [ ] No real student data, secrets, credentials, or generated binary accidentally included
- [ ] Scoped changes only; relevant documentation updated

## Verification for exact commit

**Commit SHA:**

| Check | Command | Result |
| --- | --- | --- |
| Typecheck | `npm run lint` | Not run |
| Tests | `npm test` | Not run |
| Build | `npm run build` | Not run |
| API/runtime | Document command | Not run |

If Actions minutes are exhausted, attach redacted evidence from a disposable local runner. Never label static review or a Vercel frontend preview as a passing API test.

## Risk / rollback

Describe any persistent data, authentication, external integration or deployment impacts. Include a rollback plan for runtime changes.

## Academic policy approval (if needed)

Link the owner's explicit approval; never silently reinterpret eligibility, prerequisites or unit limits.
