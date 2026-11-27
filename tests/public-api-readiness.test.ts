import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { parseArgs, probe } = require('../scripts/public-api-readiness.cjs');
const sha='a'.repeat(40);
const input={origin:'https://example.org',sha};
const json=(body:unknown,status=200,cache='no-store')=>new Response(JSON.stringify(body),{
  status,headers:{'content-type':'application/json','cache-control':cache},
});
const goodHealth=()=>json({status:'ok',product:'درس‌چین',releaseSha:sha});
const goodConfig=()=>json({success:true,data:{enabled:false,siteKey:'',registrationOtpRequired:false}});
const missing=()=>json({error:'not found'},404);

describe('گیت عمومی API بدون ایجاد چالش یا ارسال داده',()=>{
  it('فقط مبدأ معتبر و SHA کامل می‌پذیرد',()=>{
    expect(parseArgs(['--origin',input.origin,'--sha',sha])).toEqual(input);
    for(const url of ['http://example.org','https://user:pass@example.org','https://example.org/path','https://example.org/?a=1','https://example.org/#x','https://127.0.0.1','https://host.local','https://example.org:444']){
      expect(()=>parseArgs(['--origin',url,'--sha',sha])).toThrow();
    }
    expect(()=>parseArgs(['--origin',input.origin,'--sha','abc'])).toThrow();
  });
  it('تنها سه GET بدون نشست، بدون redirect و بدون ایجاد کپچا اجرا می‌کند',async()=>{
    const seen:string[]=[];
    const r=await probe(input,async(url:string,options:RequestInit)=>{
      seen.push(url);
      expect(options.method).toBe('GET');
      expect(options.credentials).toBe('omit');
      expect(options.redirect).toBe('error');
      expect(options.headers).toEqual({accept:'application/json'});
      return url.endsWith('/health')?goodHealth():url.endsWith('/challenge')?goodConfig():missing();
    });
    expect(r.ok).toBe(true);
    expect(seen).toEqual([
      input.origin+'/api/health',input.origin+'/api/security/challenge',
      input.origin+'/api/__darschin_release_probe_not_found__',
    ]);
  });
  it('نسخهٔ صرفاً استاتیک با API چهارصد و چهار را رد می‌کند',async()=>{
    const r=await probe(input,async()=>new Response('not found',{status:404}));
    expect(r.ok).toBe(false);
    expect(r.checks.map((c:{reason:string})=>c.reason)).toEqual(['unexpected-http-status','unexpected-http-status','not-json']);
  });
  it('SHA قدیمی را حتی با سلامت ظاهری رد می‌کند',async()=>{
    const r=await probe(input,async(url:string)=>url.endsWith('/health')
      ?json({status:'ok',product:'درس‌چین',releaseSha:'b'.repeat(40)})
      :url.endsWith('/challenge')?goodConfig():missing());
    expect(r.ok).toBe(false);
    expect(r.checks[0].reason).toBe('invalid-contract');
  });
  it('پیکربندی ناقص یا cache شده را رد می‌کند و کلید را گزارش نمی‌کند',async()=>{
    for(const config of [
      ()=>json({success:true,data:{enabled:true,siteKey:'',registrationOtpRequired:false}}),
      ()=>json({success:true,data:{enabled:false,siteKey:'',registrationOtpRequired:false}},200,'public'),
    ]){
      const r=await probe(input,async(url:string)=>url.endsWith('/health')?goodHealth():url.endsWith('/challenge')?config():missing());
      expect(r.ok).toBe(false);
      expect(r.checks[1].ok).toBe(false);
      expect(JSON.stringify(r)).not.toContain('siteKey');
    }
  });
  it('قطع شبکه را بدون چاپ پیام خام یا پاسخ محرمانه ثبت می‌کند',async()=>{
    const r=await probe(input,async()=>{throw new Error('private example');});
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain('private example');
  });
});
