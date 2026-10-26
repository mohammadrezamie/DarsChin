// Production-mode, disposable API smoke test. No real accounts, network dependencies or mutable project data.
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const binary = path.join(root, 'dist', 'server.cjs');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'darschin-api-smoke-'));
const rootMobile = '09999999999'; // synthetic only, inside isolated data directory
const rootPassword = crypto.randomBytes(32).toString('hex');
const testReleaseSha = crypto.randomBytes(20).toString('hex');
const environment = {
  ...process.env,
  NODE_ENV: 'production',
  HOST: '127.0.0.1',
  DARSCHYN_DATA_DIR: path.join(temporary, 'data'),
  JWT_SECRET: crypto.randomBytes(32).toString('hex'),
  DARSCHYN_RELEASE_SHA: testReleaseSha,
  ROOT_OWNER_MOBILE: rootMobile,
  ROOT_OWNER_PASSWORD: rootPassword,
  ROOT_OWNER_RECOVERY_KEY: crypto.randomBytes(32).toString('hex'),
  // Exercise the real self-hosted fallback; never depend on a live CAPTCHA key.
  TURNSTILE_ENABLED: 'false',
};
delete environment.NIAZPARDAZ_API_KEY;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let activeServer = null;
let port = null;
let baseUrl = null;

async function findUnusedPort() {
  const listener = net.createServer();
  await new Promise((resolve, reject) => {
    listener.once('error', reject);
    listener.listen(0, '127.0.0.1', resolve);
  });
  const freePort = listener.address().port;
  await new Promise((resolve) => listener.close(resolve));
  return freePort;
}

async function startServer() {
  activeServer = spawn(process.execPath, [binary], {
    cwd: root,
    env: { ...environment, PORT: String(port) },
    stdio: 'ignore',
  });
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (activeServer.exitCode !== null) {
      throw new Error('The API process exited before health became available.');
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (response.ok) {
        const data = await response.json();
        if (data.status !== 'ok') throw new Error('Unhealthy status returned');
        return;
      }
    } catch {
      // The listener may not be ready yet.
    }
    await sleep(150);
  }
  throw new Error('The API did not become healthy on the loopback interface.');
}

async function stopServer() {
  const server = activeServer;
  activeServer = null;
  if (!server || server.exitCode !== null) return;
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      server.kill('SIGKILL');
      resolve();
    }, 3000);
    server.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });
    server.kill('SIGTERM');
  });
}

async function requestJson(route, options) {
  const response = await fetch(`${baseUrl}${route}`, { ...options, signal: AbortSignal.timeout(2500) });
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) throw new Error(`${route} did not return JSON`);
  return { status: response.status, body: await response.json() };
}

async function main() {
  if (!fs.existsSync(binary)) {
    throw new Error('Missing dist/server.cjs: run bun run build first.');
  }

  port = await findUnusedPort();
  baseUrl = `http://127.0.0.1:${port}`;

  await startServer();
  const health = await requestJson('/api/health');
  if (health.status !== 200 || health.body.status !== 'ok') throw new Error('Health response failed');
  if (health.body.releaseSha !== testReleaseSha) throw new Error('Release fingerprint mismatch');

  const missing = await requestJson('/api/not-a-real-route');
  if (missing.status !== 404 || missing.body.success !== false) throw new Error('API 404 contract failed');

  const sendLogin = (captchaToken) => requestJson('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile: rootMobile, password: rootPassword, captchaToken }),
  });
  const missingCaptcha = await sendLogin(undefined);
  if (missingCaptcha.status !== 403) {
    throw new Error('SECURITY: anonymous login accepted without a human challenge');
  }
  const generated = await requestJson('/api/auth/otp/captcha/generate?action=login');
  if (generated.status !== 200 || typeof generated.body?.data?.id !== 'string' ||
      typeof generated.body?.data?.svg !== 'string' ||
      generated.body.data.answer !== undefined || generated.body.data.value !== undefined) {
    throw new Error('Local CAPTCHA did not generate a safe public challenge');
  }
  // Only inspect this test process's disposable JSON fixture, never a real
  // user's CAPTCHA answer and never print it into logs.
  const database = JSON.parse(fs.readFileSync(path.join(environment.DARSCHYN_DATA_DIR, 'darschyn-db.json'), 'utf8'));
  const issued = database.captchaChallenges.find(row => row.id === generated.body.data.id);
  if (!issued || issued.action !== 'login' || typeof issued.value !== 'string') {
    throw new Error('A login-scoped challenge was not persisted in the isolated fixture');
  }
  const captchaToken = `local:${issued.id}:${issued.value}`;
  const login = await sendLogin(captchaToken);
  const token = login.body?.data?.token;
  if (login.status !== 200 || typeof token !== 'string') throw new Error('Synthetic root login failed');
  const replay = await sendLogin(captchaToken);
  if (replay.status !== 403) throw new Error('SECURITY: guest CAPTCHA token replay succeeded');

  // Production services must never permit the old "reset to sample data"
  // endpoint: that would overwrite real students and reintroduce known logins.
  const resetDenied = await requestJson('/api/admin/reset-seed', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (resetDenied.status !== 403) {
    throw new Error('DANGEROUS: sample-database reset was not disabled in production');
  }

  const demandUnauth = await requestJson('/api/demand/surveys');
  if (demandUnauth.status !== 401) throw new Error('Demand data must require authentication');
  const demandManager = await requestJson('/api/demand/surveys', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (demandManager.status !== 200 || !Array.isArray(demandManager.body?.data)) {
    throw new Error('Authenticated demand survey endpoint was not available');
  }

  for (const previewPath of ['/demo/student', '/demo/admin']) {
    const response = await fetch(`${baseUrl}${previewPath}`, { signal: AbortSignal.timeout(2500) });
    const page = await response.text();
    if (!response.ok || !response.headers.get('content-type')?.includes('text/html') ||
        !page.includes('id="root"')) {
      throw new Error(`Browser demo shell did not load: ${previewPath}`);
    }
  }

  const sync = await requestJson('/api/sync/jobs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ termId: 'term-1405-1', campusId: 'camp-srbiau' }),
  });
  if (sync.status !== 201 || sync.body?.data?.status !== 'RUNNING') {
    throw new Error('Synthetic sync job creation failed');
  }

  await stopServer();
  await startServer();

  const afterRestart = await requestJson('/api/sync/state', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (
    afterRestart.status !== 200 ||
    afterRestart.body?.data?.lastSyncStatus !== 'RUNNING' ||
    afterRestart.body?.data?.totalSyncs !== 1
  ) {
    throw new Error('Sync job state did not survive a process restart');
  }

  console.log('PASS: health, JSON 404, single-use CAPTCHA-protected synthetic login, private demand API, disabled production reset, demo pages, and sync persistence.');
  console.log('All state was written only to a temporary isolated directory.');
}

main()
  .catch((error) => {
    console.error('API smoke test failed:', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await stopServer();
    fs.rmSync(temporary, { recursive: true, force: true });
  });
