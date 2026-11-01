import { afterEach, describe, expect, it, vi } from 'vitest';
import { assertTurnstileConfiguration, turnstilePublicConfiguration,
  validateGuestChallenge } from '../server/security/turnstile';

afterEach(()=>{ vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('guest human verification is always verified by the server',()=>{
  it('does not force a third-party dependency when disabled for Iranian pilot',async()=>{
    vi.stubEnv('TURNSTILE_ENABLED','false');
    expect(turnstilePublicConfiguration()).toEqual({enabled:false,siteKey:''});
    expect(await validateGuestChallenge(undefined,'login')).toBe(true);
  });
  it('fails startup validation when enabled without real keys',()=>{
    vi.stubEnv('TURNSTILE_ENABLED','true');
    vi.stubEnv('TURNSTILE_SITE_KEY','');
    vi.stubEnv('TURNSTILE_SECRET_KEY','');
    expect(()=>assertTurnstileConfiguration()).toThrow();
  });
  it('rejects missing tokens, wrong action, wrong hostname and upstream errors',async()=>{
    vi.stubEnv('TURNSTILE_ENABLED','true');
    vi.stubEnv('TURNSTILE_SECRET_KEY','test-secret');
    vi.stubEnv('TURNSTILE_ALLOWED_HOSTNAMES','darschyn.example');
    expect(await validateGuestChallenge('','login')).toBe(false);
    vi.stubGlobal('fetch',vi.fn(async()=>({
      ok:true,json:async()=>({success:true,action:'register',hostname:'darschyn.example'}),
    })));
    expect(await validateGuestChallenge('token','login')).toBe(false);
    vi.stubGlobal('fetch',vi.fn(async()=>({
      ok:true,json:async()=>({success:true,action:'login',hostname:'other.example'}),
    })));
    expect(await validateGuestChallenge('token','login')).toBe(false);
    vi.stubGlobal('fetch',vi.fn(async()=>{throw new Error('network unavailable')}));
    expect(await validateGuestChallenge('token','login')).toBe(false);
  });
  it('accepts only explicit successful action and configured hostname after siteverify',async()=>{
    vi.stubEnv('TURNSTILE_ENABLED','true');
    vi.stubEnv('TURNSTILE_SECRET_KEY','test-secret');
    vi.stubEnv('TURNSTILE_ALLOWED_HOSTNAMES','darschyn.example');
    vi.stubGlobal('fetch',vi.fn(async()=>({
      ok:true,json:async()=>({success:true,action:'otp',hostname:'darschyn.example'}),
    })));
    expect(await validateGuestChallenge('synthetic-token','otp')).toBe(true);
  });
});
