#!/usr/bin/env node
'use strict';

// Read-only, fail-closed staging/production gate for DarsChin's Express API.
// No deployment, service restart, database mutation, proxy modification or secrets access.
const posix = require('node:path').posix;
const { spawnSync } = require('node:child_process');
const targets = require('../deploy/targets.json');
const SHA = /^[0-9a-f]{40}$/i;
const UNITS = /^[a-z0-9-]+\.service$/;
const RESERVED = ['/var/www/tna', '/var/www/tna-releases', '/var/www/tna-shared',
  '/var/lib/mysql', '/etc/tna', '/var/backups/tna'];

function isWithin(parent, child) {
  const rel = posix.relative(parent, child);
  return rel === '' || (rel !== '..' && !rel.startsWith('../') && !posix.isAbsolute(rel));
}

function validateTargets(settings = targets) {
  const names = ['staging', 'production'];
  for (const name of names) {
    const t = settings[name];
    if (!t || t.name !== name || t.host !== '127.0.0.1' ||
        !Number.isInteger(t.port) || t.port < 1024 || t.port > 65535 ||
        !UNITS.test(t.service)) throw new Error('Invalid ' + name + ' deployment identity or loopback port');
    for (const key of ['releaseRoot', 'currentLink', 'dataDir', 'envFile']) {
      const v = t[key];
      if (typeof v !== 'string' || !v.startsWith('/') || v === '/' ||
          posix.normalize(v) !== v) throw new Error('Invalid ' + name + ' ' + key);
      if (RESERVED.some(other => isWithin(other, v) || isWithin(v, other))) {
        throw new Error('Protected external infrastructure path in ' + name + ' ' + key);
      }
    }
    if (isWithin(t.releaseRoot, t.dataDir)) throw new Error(name + ' database must remain outside release directories');
    if (isWithin(t.releaseRoot, t.currentLink)) throw new Error(name + ' current link must remain outside release directories');
  }
  const a = settings.staging, b = settings.production;
  if (a.port === b.port || a.service === b.service) {
    throw new Error('Staging and production must use different ports and systemd units');
  }
  for (const keyA of ['releaseRoot', 'currentLink', 'dataDir', 'envFile']) {
    for (const keyB of ['releaseRoot', 'currentLink', 'dataDir', 'envFile']) {
      if (isWithin(a[keyA], b[keyB]) || isWithin(b[keyB], a[keyA])) {
        throw new Error('Overlapping deployment targets: ' + keyA + ' / ' + keyB);
      }
    }
  }
  return settings;
}

function parseArgs(argv) {
  let target = '', sha = '', samples = 3, check = false, systemd = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--target' && i + 1 < argv.length) target = argv[++i];
    else if (argv[i] === '--sha' && i + 1 < argv.length) sha = argv[++i];
    else if (argv[i] === '--samples' && i + 1 < argv.length) {
      const count = argv[++i];
      if (!/^\d+$/.test(count)) throw new Error('Invalid samples');
      samples = Number(count);
    } else if (argv[i] === '--check') check = true;
    else if (argv[i] === '--systemd') systemd = true;
    else throw new Error('Usage: --target staging|production --sha <40-hex> [--check [--systemd]] [--samples 2..10]');
  }
  if (!['staging', 'production'].includes(target) || !SHA.test(sha) ||
      !Number.isInteger(samples) || samples < 2 || samples > 10 || (systemd && !check)) {
    throw new Error('Usage: --target staging|production --sha <40-hex> [--check [--systemd]] [--samples 2..10]');
  }
  return {target, sha: sha.toLowerCase(), samples, check, systemd};
}

function releasePlan(input, settings = targets) {
  validateTargets(settings);
  const t = settings[input.target];
  if (!t || !SHA.test(input.sha)) throw new Error('Unknown target or invalid release SHA');
  return {
    target: input.target, sha: input.sha.toLowerCase(),
    service: t.service, host: t.host, port: t.port,
    releaseRoot: t.releaseRoot, currentLink: t.currentLink,
    dataDir: t.dataDir, envFile: t.envFile,
    prerequisite: input.target === 'production' ? 'same-SHA staging readiness' : 'isolated qa:full and backups',
    mode: input.check ? (input.systemd ? 'read-only systemd and HTTP verification' : 'read-only HTTP verification') : 'dry-run; no deployment performed',
  };
}

// All probes stay on the configured loopback endpoint. Never follow a redirect,
// send credentials, print response bodies or treat cached challenge config as ready.
async function getJson(fetchImpl, base, route, status, label, noStore = false) {
  let response;
  try {
    response = await fetchImpl(base + route, {
      method: 'GET', headers: {accept: 'application/json'}, redirect: 'error',
      credentials: 'omit', cache: 'no-store', signal: AbortSignal.timeout(3500),
    });
  } catch {
    throw new Error(label + ': connection refused or network/redirect error');
  }
  if (response.status !== status ||
      !response.headers.get('content-type')?.toLowerCase().includes('application/json')) {
    await response.body?.cancel().catch(() => {});
    throw new Error(label + ': expected HTTP ' + status + ' JSON (' + (status === 404 ? 'JSON 404' : 'invalid response') + ')');
  }
  if (noStore && !/\bno-store\b/i.test(response.headers.get('cache-control') || '')) {
    await response.body?.cancel().catch(() => {});
    throw new Error(label + ': unsafe cache policy');
  }
  let body;
  try { body = await response.json(); }
  catch { throw new Error(label + ': body must be valid JSON'); }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error(label + ': body must be valid JSON object');
  }
  return body;
}

// Only allow the two committed unit names and selected non-secret properties.
// Never query Environment, command lines, journals or another product's units.
const STATE_FIELDS = ['LoadState','ActiveState','SubState','Result','MainPID','NRestarts','InvocationID','ActiveEnterTimestampMonotonic'];

function readUnitState(unit, run = spawnSync) {
  if (!Object.values(targets).some(t => t.service === unit)) throw new Error('Unexpected systemd unit');
  let result;
  try {
    result = run('/usr/bin/systemctl', ['show','--no-pager',...STATE_FIELDS.map(k=>'--property='+k),'--',unit], {
      encoding:'utf8', timeout:3500, maxBuffer:16384, shell:false, stdio:['ignore','pipe','ignore'],
    });
  } catch { throw new Error('Unable to read service state'); }
  if (!result || result.error || result.status !== 0 || typeof result.stdout !== 'string') {
    throw new Error('Unable to read service state');
  }
  const state = Object.create(null);
  for (const line of result.stdout.split(/\r?\n/).filter(Boolean)) {
    const index = line.indexOf('=');
    const key = line.slice(0,index);
    if (index < 1 || !STATE_FIELDS.includes(key) || Object.hasOwn(state,key)) throw new Error('Invalid service state');
    state[key] = line.slice(index+1);
  }
  return validateUnitState(state);
}

function validateUnitState(state) {
  if (!state || state.LoadState !== 'loaded' || state.ActiveState !== 'active' ||
      state.SubState !== 'running' || state.Result !== 'success' ||
      !/^[1-9]\d*$/.test(state.MainPID || '') ||
      !/^(?:0|[1-9]\d*)$/.test(state.NRestarts || '') ||
      !/^[0-9a-f]{32}$/i.test(state.InvocationID || '') || /^0+$/.test(state.InvocationID) ||
      !/^[1-9]\d*$/.test(state.ActiveEnterTimestampMonotonic || '')) {
    throw new Error('Service not active/running or invalid service state');
  }
  return {
    pid:state.MainPID, restarts:state.NRestarts, invocation:state.InvocationID,
    activeSince:state.ActiveEnterTimestampMonotonic,
  };
}

function assertStableUnit(before, after) {
  if (['pid','restarts','invocation','activeSince'].some(key => before[key] !== after[key])) {
    throw new Error('Service restarted or changed during readiness observation');
  }
}

async function checkOne(name, sha, samples, {
  fetchImpl = globalThis.fetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  settings = targets,
  systemd = false,
  unitReader = readUnitState,
} = {}) {
  const base = 'http://127.0.0.1:' + settings[name].port;
  const baseline = systemd ? unitReader(settings[name].service) : null;
  for (let i = 0; i < samples; i++) {
    if (baseline) assertStableUnit(baseline, unitReader(settings[name].service));
    const data = await getJson(fetchImpl, base, '/api/health', 200, name + ' health');
    if (data.status !== 'ok' || data.product !== 'درس‌چین' ||
        typeof data.releaseSha !== 'string' || data.releaseSha.toLowerCase() !== sha.toLowerCase()) {
      throw new Error(name + ': unexpected health status or release SHA');
    }
    const challenge = await getJson(fetchImpl, base, '/api/security/challenge', 200, name + ' challenge', true);
    const config = challenge.data;
    if (challenge.success !== true || typeof config?.enabled !== 'boolean' ||
        typeof config.registrationOtpRequired !== 'boolean' || typeof config.siteKey !== 'string' ||
        (config.enabled ? !config.siteKey.trim() : config.siteKey !== '')) {
      throw new Error(name + ': invalid challenge configuration');
    }
    await getJson(fetchImpl, base, '/api/__darschin_release_probe_not_found__', 404, name + ' API fallback');
    if (baseline) assertStableUnit(baseline, unitReader(settings[name].service));
    if (i + 1 < samples) await sleep(systemd ? 5000 : 250);
  }
  return {target: name, port: settings[name].port, sha, samples, ok: true, systemdVerified: systemd};
}

async function verifyDeployment(input, deps = {}) {
  validateTargets(deps.settings || targets);
  if (!['staging', 'production'].includes(input.target) || !SHA.test(input.sha) ||
      !Number.isInteger(input.samples) || input.samples < 2 || input.samples > 10) {
    throw new Error('Invalid release verification request');
  }
  if (input.systemd && input.check !== true) throw new Error('Systemd verification requires explicit check');
  const probeDeps = {...deps, systemd: input.systemd === true};
  const result = [];
  if (input.target === 'production') {
    // Production is not announced healthy until the exact same SHA is running
    // and healthy in the isolated staging environment.
    result.push(await checkOne('staging', input.sha, input.samples, probeDeps));
  }
  result.push(await checkOne(input.target, input.sha, input.samples, probeDeps));
  return result;
}

if (require.main === module) {
  (async () => {
    try {
      const config = parseArgs(process.argv.slice(2));
      console.log(JSON.stringify(releasePlan(config), null, 2));
      if (!config.check) {
        console.log('DRY RUN: no files, services, databases, websites or VPS settings were changed.');
        return;
      }
      const result = await verifyDeployment(config);
      console.log('PASS: ' + result.map(x => x.target + ' release=' + x.sha + ' port=' + x.port + (x.systemdVerified ? ' systemd=stable-during-observation' : ' HTTP-only')).join('; '));
    } catch (err) {
      console.error('FAIL: ' + (err instanceof Error ? err.message : 'release readiness check failed'));
      process.exitCode = 1;
    }
  })();
}
module.exports = {targets, isWithin, validateTargets, parseArgs, releasePlan, readUnitState, validateUnitState, assertStableUnit, checkOne, verifyDeployment};
