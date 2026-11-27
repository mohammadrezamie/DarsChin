import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const read=(p:string)=>readFileSync(resolve(process.cwd(),p),'utf8');
const targets=JSON.parse(read('deploy/targets.json'));
describe('قرارداد نمونه‌های استقرار نسخه یک',()=>{
 for(const name of ['staging','production'] as const){
   it('matches '+name+' unit to the isolated target',()=>{
     const t=targets[name];
     const unit=read('deploy/'+t.service+'.example');
     for(const value of [
       'WorkingDirectory='+t.currentLink,'EnvironmentFile='+t.envFile,
       'Environment=HOST='+t.host,'Environment=PORT='+t.port,
       'Environment=DARSCHYN_DATA_DIR='+t.dataDir,'ReadWritePaths='+t.dataDir,
       'ExecStartPre=/usr/bin/test -r '+t.currentLink+'/dist/server.cjs',
       'ExecStartPre=/usr/bin/test -d '+t.dataDir,
       'StartLimitBurst=4','StartLimitIntervalSec=120','UMask=0077','ProtectSystem=strict',
       'NoNewPrivileges=true','PrivateTmp=true',
       'User='+ (name==='staging'?'darschyn-staging':'darschyn'),
     ]) expect(unit.split(/\r?\n/)).toContain(value);
     expect(unit).not.toContain('/var/www/tna');
   });
 }
 it('matches both production reverse proxy routes and prevents supplied forwarding chain',()=>{
   const nginx=read('deploy/nginx-darschyn.conf.example');
   expect([...nginx.matchAll(/proxy_pass http:\/\/127\.0\.0\.1:(\d+)/g)].map(x=>Number(x[1]))).toEqual([targets.production.port,targets.production.port]);
   expect(nginx).toContain('proxy_set_header X-Forwarded-For $remote_addr;');
   expect(nginx).not.toContain('$proxy_add_x_forwarded_for');
   expect(nginx).toContain('proxy_cache off;');
 });
 it('keeps host and container ports distinct and aligned with env templates',()=>{
   expect(read('deploy/.env.vps.example')).toContain('DARSCHYN_LOCAL_PORT='+targets.production.port);
   expect(read('deploy/.env.staging.example')).toContain('PORT='+targets.staging.port);
   expect(read('compose.pilot-ssh.yaml')).toContain('127.0.0.1:${DARSCHYN_LOCAL_PORT:-'+targets.production.port+'}:3000');
   expect(read('compose.yaml')).toContain('PORT: 3000');
   expect(read('deploy/Caddyfile')).toContain('reverse_proxy darschin:3000');
 });
});
