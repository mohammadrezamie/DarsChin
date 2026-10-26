#!/usr/bin/env node
'use strict';

// Read-only, fail-closed staging/production gate for DarsChin's Express API.
// No deployment, service restart, database mutation, proxy modification or secrets access.
const posix = require('node:path').posix;
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
  let target = '', sha = '', samples = 3, check = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--target' && i + 1 < argv.length) target = argv[++i];
    else if (argv[i] === '--sha' && i + 1 < argv.length) sha = argv[++i];
    else if (argv[i] === '--samples' && i + 1 < argv.length) {
      const count = argv[++i];
      if (!/^\d+$/.test(count)) throw new Error('Invalid samples');
      samples = Number(count);
    } else if (argv[i] === '--check') check = true;
    else throw new Error('Usage: --target staging|production --sha <40-hex> [--check] [--samples 2..10]');
  }
  if (!['staging', 'production'].includes(target) || !SHA.test(sha) ||
      !Number.isInteger(samples) || samples < 2 || samples > 10) {
    throw new Error('Usage: --target staging|production --sha <40-hex> [--check] [--samples 2..10]');
  }
  return {target, sha: sha.toLowerCase(), samples, check};
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
    mode: input.check ? 'read-only HTTP verification' : 'dry-run; no deployment performed',
  };
}

async function checkOne(name, sha, samples, {
  fetchImpl = globalThis.fetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)),
  settings = targets,
} = {}) {
  const base = 'http://127.0.0.1:' + settings[name].port;
  for (let i = 0; i < samples; i++) {
    const health = await fetchImpl(base + '/api/health', {
      headers: {accept: 'application/json'}, signal: AbortSignal.timeout(3500),
    });
    if (health.status !== 200 || !health.headers.get('content-type')?.includes('application/json')) {
      throw new Error(name + ': health is not HTTP 200 JSON');
    }
    const data = await health.json();
    if (data?.status !== 'ok' || data?.product !== 'درس‌چین' ||
        data?.releaseSha?.toLowerCase() !== sha.toLowerCase()) {
      throw new Error(name + ': unexpected health status or release SHA');
    }
    const missing = await fetchImpl(base + '/api/__darschin_release_probe_not_found__', {
      headers: {accept: 'application/json'}, signal: AbortSignal.timeout(3500),
    });
    if (missing.status !== 404 || !missing.headers.get('content-type')?.includes('application/json')) {
      throw new Error(name + ': API fallback must return JSON 404, not a frontend page');
    }
    if (i + 1 < samples) await sleep(250);
  }
  return {target: name, port: settings[name].port, sha, samples, ok: true};
}

async function verifyDeployment(input, deps = {}) {
  validateTargets(deps.settings || targets);
  if (!['staging', 'production'].includes(input.target) || !SHA.test(input.sha) ||
      !Number.isInteger(input.samples) || input.samples < 2 || input.samples > 10) {
    throw new Error('Invalid release verification request');
  }
  const result = [];
  if (input.target === 'production') {
    // Production is not announced healthy until the exact same SHA is running
    // and healthy in the isolated staging environment.
    result.push(await checkOne('staging', input.sha, input.samples, deps));
  }
  result.push(await checkOne(input.target, input.sha, input.samples, deps));
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
      console.log('PASS: ' + result.map(x => x.target + ' release=' + x.sha + ' port=' + x.port).join('; '));
    } catch (err) {
      console.error('FAIL: ' + (err instanceof Error ? err.message : 'release readiness check failed'));
      process.exitCode = 1;
    }
  })();
}
module.exports = {targets, isWithin, validateTargets, parseArgs, releasePlan, checkOne, verifyDeployment};
