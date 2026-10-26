'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {serviceState,listenerAddresses,checkReadiness,parseArgs}=
  require('./check-vps-readiness.cjs');

const sha='5a6c51fe5e5453057d664b96f70ce35bd15879b6';
const running={active:'active',substate:'running',pid:1234,restarts:55};
const fake=(changes={})=>({
  service:async()=>changes.state||running,
  listeners:async()=>changes.addresses===undefined?['127.0.0.1']:changes.addresses,
  health:async()=>changes.health||{status:200,json:{status:'ok',product:'درس‌چین',releaseSha:sha}},
  sleep:async()=>{},
});

test('systemd fields parsed without printing sensitive journal output',()=>{
  assert.deepEqual(serviceState('ActiveState=active\nSubState=running\nNRestarts=55\nMainPID=1234\n'),running);
  assert.deepEqual(parseArgs(['--sha',sha,'--port','3001']),{sha,port:3001});
  assert.throws(()=>parseArgs(['--host','0.0.0.0']),/Usage/);
});

test('listener check recognizes only loopback when exactly one private listener',()=>{
  const sample='LISTEN 0 511 127.0.0.1:3001 0.0.0.0:*\nLISTEN 0 511 0.0.0.0:443 0.0.0.0:*\n';
  assert.deepEqual(listenerAddresses(sample,3001),['127.0.0.1']);
  assert.deepEqual(listenerAddresses(sample,3000),[]);
  assert.deepEqual(listenerAddresses('LISTEN 0 128 0.0.0.0:3001 0.0.0.0:*\n',3001),['0.0.0.0']);
});

test('fails closed on startup crash, missing listener, wrong SHA or public binding',async()=>{
  for(const changes of [
    {state:{...running,active:'activating',substate:'auto-restart'}},
    {state:{...running,pid:0}},
    {addresses:[]},
    {addresses:['0.0.0.0']},
    {addresses:['127.0.0.1','0.0.0.0']},
    {health:{status:200,json:{status:'ok',product:'درس‌چین',releaseSha:'a'.repeat(40)}}},
    {health:{status:503,json:{status:'maintenance',product:'درس‌چین',releaseSha:sha}}},
  ]){
    await assert.rejects(checkReadiness({sha,delayMs:0},fake(changes)));
  }
});

test('detects process restarts even when health happens to recover',async()=>{
  let count=0;
  const deps=fake();
  deps.service=async()=>++count<3?running:{...running,restarts:56,pid:4321};
  await assert.rejects(checkReadiness({sha,delayMs:0},deps),/restarted/);
});

test('only an exact stable matching release receives success',async()=>{
  assert.deepEqual(await checkReadiness({sha,delayMs:0},fake()),{
    ok:true,sha,port:3001,pid:1234,restarts:55,
  });
  await assert.rejects(checkReadiness({sha:'short',delayMs:0},fake()),/40-character/);
  await assert.rejects(checkReadiness({sha,port:80,delayMs:0},fake()),/Invalid private/);
});
