#!/usr/bin/env node
'use strict';

// فقط بررسی عمومی HTTPS؛ بدون نشست، صدور کپچا، ورود، پیامک یا تغییر داده.
const SHA = /^[a-f0-9]{40}$/i;
function parseArgs(args) {
  if (args.length !== 4 || args[0] !== '--origin' || args[2] !== '--sha' || !SHA.test(args[3])) {
    throw new Error('کاربرد: --origin https://example.org --sha <40-hex>');
  }
  let u;
  try { u = new URL(args[1]); } catch { throw new Error('نشانی HTTPS معتبر نیست.'); }
  if (u.protocol !== 'https:' || u.username || u.password || u.search || u.hash ||
      u.pathname !== '/' || u.port || !/^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(u.hostname) ||
      /^(?:\d+\.)+\d+$/.test(u.hostname) || /\.(?:local|localhost|internal|test|invalid)$/i.test(u.hostname)) {
    throw new Error('فقط مبدأ HTTPS عمومی بدون مسیر یا اطلاعات حساب مجاز است.');
  }
  return { origin:u.origin, sha:args[3].toLowerCase() };
}
async function probe({origin,sha}, fetchImpl = globalThis.fetch) {
  const input = parseArgs(['--origin',origin,'--sha',sha]);
  const checks = [
    {name:'health', path:'/api/health', status:200,
      validate: body => body?.status==='ok' && body?.product==='درس‌چین' && body?.releaseSha?.toLowerCase()===input.sha},
    {name:'challenge-config',path:'/api/security/challenge',status:200,noStore:true,
      validate: body => body?.success===true && typeof body.data?.enabled==='boolean' &&
        typeof body.data?.registrationOtpRequired==='boolean' && typeof body.data?.siteKey==='string' &&
        (body.data.enabled ? body.data.siteKey.trim().length>0 : body.data.siteKey==='')},
    {name:'api-not-found',path:'/api/__darschin_release_probe_not_found__',status:404,
      validate: body => body!==null && typeof body==='object' && !Array.isArray(body)},
  ];
  const results=[];
  for (const check of checks) {
    try {
      const response=await fetchImpl(input.origin+check.path,{
        method:'GET',headers:{accept:'application/json'},redirect:'error',credentials:'omit',
        cache:'no-store',signal:AbortSignal.timeout(5000),
      });
      const status=response.status;
      if(status!==check.status) {
        await response.body?.cancel();
        results.push({name:check.name,ok:false,reason:'unexpected-http-status',status});continue;
      }
      if(!response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
        await response.body?.cancel();
        results.push({name:check.name,ok:false,reason:'not-json',status});continue;
      }
      if(check.noStore&&!/\bno-store\b/i.test(response.headers.get('cache-control')||'')) {
        await response.body?.cancel();
        results.push({name:check.name,ok:false,reason:'unsafe-cache-policy',status});continue;
      }
      let body;
      try {body=await response.json();} catch {
        results.push({name:check.name,ok:false,reason:'invalid-json',status});continue;
      }
      const ok=Boolean(check.validate(body));
      results.push({name:check.name,ok,reason:ok?'ok':'invalid-contract',status});
    } catch {
      results.push({name:check.name,ok:false,reason:'network-or-response-error'});
    }
  }
  return {ok:results.every(r=>r.ok),checks:results};
}
if(require.main===module) {
  (async()=>{
    try {
      const input=parseArgs(process.argv.slice(2));
      const result=await probe(input);
      console.log(JSON.stringify(result,null,2));
      if(!result.ok)process.exitCode=1;
    } catch {
      console.error('پارامتر یا اجرای گیت نامعتبر است؛ هیچ اطلاعات پاسخ یا حساب چاپ نمی‌شود.');
      process.exitCode=1;
    }
  })();
}
module.exports={parseArgs,probe};
