import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';

const require = createRequire(import.meta.url);
const gate = require('../scripts/deploy-target-gate.cjs');
const SHA = 'f'.repeat(40);
const cloned = () => JSON.parse(JSON.stringify(gate.targets));
const ok = (sha = SHA) => new Response(JSON.stringify({status:'ok',product:'درس‌چین',releaseSha:sha}),{
  status:200,headers:{'content-type':'application/json; charset=utf-8'},
});
const challenge = (enabled=false, siteKey='', cache='no-store') => new Response(JSON.stringify({
  success:true,data:{enabled,siteKey,registrationOtpRequired:false},
}),{status:200,headers:{'content-type':'application/json','cache-control':cache}});
const missing = () => new Response(JSON.stringify({error:'Not Found'}),{
  status:404,headers:{'content-type':'application/json'},
});

describe('isolated staging and production deployment gate', () => {
  it('defines separate staging/production services, ports, data and credentials', () => {
    expect(gate.validateTargets()).toBe(gate.targets);
    const {staging,production} = gate.targets;
    expect(staging.host).toBe('127.0.0.1');
    expect(production.host).toBe('127.0.0.1');
    for(const field of ['port','service','releaseRoot','currentLink','dataDir','envFile']){
      expect(staging[field]).not.toBe(production[field]);
    }
    expect(staging.port).toBe(3002);
    expect(production.port).toBe(3001);
  });

  it('refuses shared ports/services and nested persistent databases',()=>{
    const sharedPort=cloned();sharedPort.staging.port=3001;
    expect(()=>gate.validateTargets(sharedPort)).toThrow(/different ports/);
    const sharedService=cloned();sharedService.staging.service='darschyn.service';
    expect(()=>gate.validateTargets(sharedService)).toThrow(/different ports/);
    const sharedData=cloned();sharedData.staging.dataDir='/var/lib/darschyn/children';
    expect(()=>gate.validateTargets(sharedData)).toThrow(/Overlapping/);
    const nestedRelease=cloned();nestedRelease.staging.dataDir='/opt/darschyn-staging/releases/data';
    expect(()=>gate.validateTargets(nestedRelease)).toThrow(/outside release/);
  });

  it('rejects paths owned by TakinTech or the shared database',()=>{
    for(const p of ['/var/www/tna','/var/www/tna/data','/var/backups/tna/db','/var/lib/mysql','/etc/tna/production.env']){
      const settings=cloned();settings.staging.dataDir=p;
      expect(()=>gate.validateTargets(settings),p).toThrow(/Protected external infrastructure/);
    }
  });

  it('requires loopback, 40-character SHA and rejects --apply',()=>{
    const unsafe=cloned();unsafe.staging.host='0.0.0.0';
    expect(()=>gate.validateTargets(unsafe)).toThrow();
    expect(()=>gate.parseArgs(['--target','staging','--sha','1234567'])).toThrow(/Usage/);
    expect(()=>gate.parseArgs(['--target','production','--sha',SHA,'--apply'])).toThrow(/Usage/);
    expect(()=>gate.parseArgs(['--target','staging','--sha',SHA,'--samples','1'])).toThrow(/Usage/);
  });

  it('prints a read-only dry run by default',()=>{
    const args=gate.parseArgs(['--target','staging','--sha',SHA]);
    const plan=gate.releasePlan(args);
    expect(args.check).toBe(false);
    expect(plan.mode).toContain('dry-run');
    expect(plan.dataDir).toBe('/var/lib/darschyn-staging');
    expect(plan).not.toHaveProperty('credentials');
  });

  it('checks staging repeatedly for matching health and JSON 404',async()=>{
    const urls:string[]=[];
    const x=await gate.verifyDeployment({target:'staging',sha:SHA,samples:3},{
      fetchImpl:async (url:string)=>{urls.push(url);return url.endsWith('/api/health')?ok():url.endsWith('/challenge')?challenge():missing();},
      sleep:async()=>{},
    });
    expect(x).toHaveLength(1);
    expect(urls).toHaveLength(9);
    expect(urls.every(u=>u.startsWith('http://127.0.0.1:3002/api/'))).toBe(true);
  });

  it('checks the exact SHA on staging before any production request',async()=>{
    const urls:string[]=[];
    const x=await gate.verifyDeployment({target:'production',sha:SHA,samples:2},{
      fetchImpl:async(url:string)=>{urls.push(url);return url.endsWith('/api/health')?ok():url.endsWith('/challenge')?challenge():missing();},
      sleep:async()=>{},
    });
    expect(x.map((o:{target:string})=>o.target)).toEqual(['staging','production']);
    expect(urls).toHaveLength(12);
    expect(urls.slice(0,6).every(u=>u.includes(':3002/'))).toBe(true);
    expect(urls.slice(6).every(u=>u.includes(':3001/'))).toBe(true);
  });

  it('refuses a production check when staging has a different SHA',async()=>{
    const urls:string[]=[];
    await expect(gate.verifyDeployment({target:'production',sha:SHA,samples:2},{
      fetchImpl:async(url:string)=>{urls.push(url);return url.endsWith('/api/health')?ok('0'.repeat(40)):missing();},
      sleep:async()=>{},
    })).rejects.toThrow(/release SHA/);
    expect(urls.every(u=>u.includes(':3002/'))).toBe(true);
  });

  it('rejects frontend HTML being served for an unknown API route',async()=>{
    await expect(gate.verifyDeployment({target:'staging',sha:SHA,samples:2},{
      fetchImpl:async(url:string)=>url.endsWith('/api/health')?ok():url.endsWith('/challenge')?challenge():new Response('<html>SPA</html>',{
        status:200,headers:{'content-type':'text/html'},
      }),
      sleep:async()=>{},
    })).rejects.toThrow(/JSON 404/);
  });

  it('rejects an invalid 404 body even if Content-Type pretends to be JSON',async()=>{
    await expect(gate.verifyDeployment({target:'staging',sha:SHA,samples:2},{
      fetchImpl:async(url:string)=>url.endsWith('/api/health')?ok():url.endsWith('/challenge')?challenge():new Response('<html>not JSON</html>',{
        status:404,headers:{'content-type':'application/json'},
      }),
      sleep:async()=>{},
    })).rejects.toThrow(/valid JSON/);
  });

  it('fails closed when the staging service is unreachable',async()=>{
    await expect(gate.verifyDeployment({target:'staging',sha:SHA,samples:2},{
      fetchImpl:async()=>{throw new Error('connection refused');},
      sleep:async()=>{},
    })).rejects.toThrow(/connection refused/);
  });

  it('uses real ephemeral HTTP listeners for stage-then-production verification and fail-closed mismatch',async()=>{
    const settings=cloned();
    let wrongStage=false;
    let productionRequests=0;
    const serve=async(kind:'staging'|'production')=>{
      const server=createServer((req,res)=>{
        if(kind==='production')productionRequests+=1;
        const health=req.url==='/api/health';
        const config=req.url==='/api/security/challenge';
        res.writeHead(health||config?200:404,{'content-type':'application/json','cache-control':'no-store'});
        res.end(JSON.stringify(health
          ? {status:'ok',product:'درس‌چین',releaseSha:kind==='staging'&&wrongStage?'0'.repeat(40):SHA}
          : config ? {success:true,data:{enabled:false,siteKey:'',registrationOtpRequired:false}} : {error:'not found'}));
      });
      await new Promise<void>((resolve,reject)=>{
        server.once('error',reject);
        server.listen(0,'127.0.0.1',resolve);
      });
      settings[kind].port=(server.address() as AddressInfo).port;
      return server;
    };
    const staging=await serve('staging');
    const production=await serve('production');
    try{
      const verified=await gate.verifyDeployment({target:'production',sha:SHA,samples:2},{
        settings,sleep:async()=>{},
      });
      expect(verified.map((row:{target:string})=>row.target)).toEqual(['staging','production']);
      expect(productionRequests).toBeGreaterThan(0);
      const before=productionRequests;
      wrongStage=true;
      await expect(gate.verifyDeployment({target:'production',sha:SHA,samples:2},{
        settings,sleep:async()=>{},
      })).rejects.toThrow(/release SHA/);
      expect(productionRequests).toBe(before);
    }finally{
      await Promise.all([staging,production].map(server=>
        new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()))));
    }
  });

  it('never checks production when staging challenge configuration is invalid or cacheable',async()=>{
    for(const config of [()=>challenge(true,''),()=>challenge(false,'unexpected'),()=>challenge(false,'','public')]){
      const urls:string[]=[];
      await expect(gate.verifyDeployment({target:'production',sha:SHA,samples:2},{
        fetchImpl:async(url:string,options:RequestInit)=>{
          urls.push(url);
          expect(options.method).toBe('GET');
          expect(options.redirect).toBe('error');
          expect(options.credentials).toBe('omit');
          expect(options.cache).toBe('no-store');
          return url.endsWith('/health')?ok():config();
        },sleep:async()=>{},
      })).rejects.toThrow(/challenge/);
      expect(urls.every(url=>url.includes(':3002/'))).toBe(true);
    }
  });

  it('rejects a redirect from loopback without contacting the redirected server or printing raw errors',async()=>{
    let outsideRequests=0;
    const outside=createServer((_req,res)=>{outsideRequests++;res.end('unexpected');});
    await new Promise<void>(resolve=>outside.listen(0,'127.0.0.1',resolve));
    const port=(outside.address() as AddressInfo).port;
    const local=createServer((_req,res)=>{res.writeHead(302,{location:'http://127.0.0.1:'+port+'/private'});res.end();});
    await new Promise<void>(resolve=>local.listen(0,'127.0.0.1',resolve));
    const settings=cloned();
    settings.staging.port=(local.address() as AddressInfo).port;
    try{
      await expect(gate.verifyDeployment({target:'staging',sha:SHA,samples:2},{settings,sleep:async()=>{}})).rejects.toThrow(/network\/redirect error/);
      expect(outsideRequests).toBe(0);
    }finally{
      await Promise.all([local,outside].map(s=>new Promise<void>((resolve,reject)=>s.close(e=>e?reject(e):resolve()))));
    }
  });

  it('ships a staging-only hardened service and excludes the TNA VPS paths',()=>{
    const unit=readFileSync(resolve(process.cwd(),'deploy/darschyn-staging.service.example'),'utf8');
    expect(unit).toContain('EnvironmentFile=/etc/darschyn/staging.env');
    expect(unit).toContain('WorkingDirectory=/opt/darschyn-staging/current');
    expect(unit).toContain('Environment=PORT=3002');
    expect(unit).toContain('Environment=HOST=127.0.0.1');
    expect(unit).toContain('ReadWritePaths=/var/lib/darschyn-staging');
    expect(unit).not.toContain('/var/www/tna');
  });
});
