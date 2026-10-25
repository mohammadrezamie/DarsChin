#!/usr/bin/env node
'use strict';

// Read-only verification of the *already installed* DarsChin systemd service.
// No service start/restart, no downloads, no edits, no secrets read or printed.
const {execFileSync}=require('node:child_process');

const SHA_RE=/^[a-f0-9]{40}$/i;
const LOOPBACK='127.0.0.1';
const DEFAULT_PORT=3001;

function serviceState(raw){
  const values=Object.fromEntries(String(raw).trim().split(/\r?\n/)
    .filter(line=>line.includes('='))
    .map(line=>{const i=line.indexOf('=');return [line.slice(0,i),line.slice(i+1)];}));
  return {
    active:values.ActiveState,
    substate:values.SubState,
    restarts:Number(values.NRestarts),
    pid:Number(values.MainPID),
  };
}

function listenerAddresses(raw,port){
  const result=[];
  for(const line of String(raw).split(/\r?\n/)){
    const cells=line.trim().split(/\s+/);
    if(cells[0]!=='LISTEN'||cells.length<5)continue;
    const local=cells[3];
    const found=local.match(/:(\d+)$/);
    if(found&&Number(found[1])===port)result.push(local.slice(0,-found[0].length));
  }
  return result;
}

function assertState(state){
  if(state.active!=='active'||state.substate!=='running'||!Number.isInteger(state.pid)||state.pid<=0)
    throw new Error('DarsChin systemd service is not active/running with a live PID');
  if(!Number.isSafeInteger(state.restarts)||state.restarts<0)
    throw new Error('Invalid systemd NRestarts value');
}

async function checkReadiness({sha,port=DEFAULT_PORT,samples=3,delayMs=1200},deps){
  if(!SHA_RE.test(sha||''))throw new Error('Supply the exact 40-character release SHA');
  if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid private service port');
  if(!Number.isInteger(samples)||samples<2||samples>10)throw new Error('Invalid stability sample count');
  const baseline=await deps.service();
  assertState(baseline);
  for(let i=0;i<samples;i++){
    const state=await deps.service();
    assertState(state);
    if(state.pid!==baseline.pid || state.restarts!==baseline.restarts)
      throw new Error('DarsChin service restarted during the stability window');
    const addresses=await deps.listeners(port);
    if(addresses.length!==1||addresses[0]!==LOOPBACK)
      throw new Error('Expected exactly one DarsChin listener bound to 127.0.0.1 only');
    const response=await deps.health(port);
    if(response.status!==200||!response.json||
       response.json.status!=='ok'||response.json.product!=='درس‌چین'||
       response.json.releaseSha?.toLowerCase()!==sha.toLowerCase())
      throw new Error('DarsChin health status or release SHA mismatch');
    if(i<samples-1)await deps.sleep(delayMs);
  }
  return {ok:true,sha:sha.toLowerCase(),port,pid:baseline.pid,restarts:baseline.restarts};
}

const productionDeps={
  service:async()=>{
    const raw=execFileSync('systemctl',[
      'show','darschyn.service','--no-pager',
      '--property=ActiveState,SubState,NRestarts,MainPID',
    ],{encoding:'utf8',timeout:3500});
    return serviceState(raw);
  },
  listeners:async(port)=>{
    const output=execFileSync('ss',['-H','-ltn'],{encoding:'utf8',timeout:3500});
    return listenerAddresses(output,port);
  },
  health:async(port)=>{
    const response=await fetch('http://127.0.0.1:'+port+'/api/health',{
      headers:{accept:'application/json'},
      signal:AbortSignal.timeout(3000),
    });
    if(!response.headers.get('content-type')?.includes('application/json'))
      throw new Error('Health returned a non-JSON response');
    return {status:response.status,json:await response.json()};
  },
  sleep:ms=>new Promise(resolve=>setTimeout(resolve,ms)),
};

function parseArgs(argv){
  let sha='',port=DEFAULT_PORT;
  for(let i=0;i<argv.length;i++){
    const a=argv[i];
    if(a==='--sha'&&i+1<argv.length)sha=argv[++i];
    else if(a==='--port'&&i+1<argv.length){
      const v=argv[++i];
      if(!/^\d+$/.test(v))throw new Error('Invalid port');
      port=Number(v);
    }else throw new Error('Usage: node scripts/check-vps-readiness.cjs --sha <40-hex> [--port 3001]');
  }
  return {sha,port};
}

if(require.main===module){
  (async()=>{
    try{
      const result=await checkReadiness(parseArgs(process.argv.slice(2)),productionDeps);
      console.log('PASS: DarsChin active/running, private listener, stable restarts, JSON health, exact SHA '+result.sha);
    }catch(err){
      // Intentionally print only a short message: never dump env, URLs with keys,
      // journal, response bodies, or the full process command line.
      console.error('FAIL: '+(err instanceof Error?err.message:'readiness check failed'));
      process.exitCode=1;
    }
  })();
}
module.exports={serviceState,listenerAddresses,assertState,checkReadiness,parseArgs};
