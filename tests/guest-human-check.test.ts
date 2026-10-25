import { afterEach, describe, expect, it, vi } from 'vitest';
import { db } from '../server/db/database';
import { assertTurnstileConfiguration, turnstilePublicConfiguration,
  validateGuestChallenge } from '../server/security/turnstile';

afterEach(()=>{ vi.unstubAllEnvs(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('guest human verification is always verified by the server',()=>{
  it('requires a valid single-use local CAPTCHA if Cloudflare is disabled',async()=>{
    vi.stubEnv('TURNSTILE_ENABLED','false');
    vi.spyOn(db,'save').mockImplementation(()=>{});
    expect(turnstilePublicConfiguration()).toEqual({enabled:false,siteKey:''});
    expect(await validateGuestChallenge(undefined,'login')).toBe(false);

    const id='00000000-0000-4000-8000-000000000001';
    const row={id,value:'AbC42',createdAt:Date.now(),
      expiresAt:Date.now()+300_000,attempts:0};
    db.captchaChallenges.push(row);
    try {
      expect(await validateGuestChallenge(`local:${id}:wrong`,'login')).toBe(false);
      expect(row.attempts).toBe(1);
      expect(await validateGuestChallenge(`local:${id}:abc42`,'login')).toBe(true);
      expect(row).toHaveProperty('consumedAt');
      expect(await validateGuestChallenge(`local:${id}:abc42`,'register')).toBe(false);
    } finally {
      db.data.captchaChallenges=db.captchaChallenges.filter(item=>item.id!==id);
    }
  });
  it('rejects expired and exhausted local challenges',async()=>{
    vi.stubEnv('TURNSTILE_ENABLED','false');
    vi.spyOn(db,'save').mockImplementation(()=>{});
    const id='00000000-0000-4000-8000-000000000002';
    const row={id,value:'XyZ77',createdAt:Date.now()-600_000,
      expiresAt:Date.now()-1,attempts:0};
    db.captchaChallenges.push(row);
    try {
      expect(await validateGuestChallenge(`local:${id}:XyZ77`,'register')).toBe(false);
      row.expiresAt=Date.now()+300_000;
      row.attempts=5;
      expect(await validateGuestChallenge(`local:${id}:XyZ77`,'register')).toBe(false);
    } finally {
      db.data.captchaChallenges=db.captchaChallenges.filter(item=>item.id!==id);
    }
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
