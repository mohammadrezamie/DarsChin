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
  // Smoke bootstraps an intentionally empty disposable store. Real release
  // instances should require the already-provisioned persistent DB.
  DARSCHYN_REQUIRE_EXISTING_DB: 'false',
  JWT_SECRET: crypto.randomBytes(32).toString('hex'),
  DARSCHYN_RELEASE_SHA: testReleaseSha,
  // Only a synthetic reserved test origin; never use a user-supplied Host.
  DARSCHYN_PUBLIC_SITE_URL: 'https://darschin.example',
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

  // Crawlable marketing content must be accurate on the FIRST HTTP response,
  // with no dependence on browser-side JavaScript or a real production domain.
  const publicPage = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(3500) });
  const publicHtml = await publicPage.text();
  if (publicPage.status !== 200 ||
      !publicHtml.includes('<link rel="canonical" href="https://darschin.example/"') ||
      !publicHtml.includes('name="robots" content="index, follow"') ||
      (publicHtml.match(/name="robots"/g) || []).length !== 1 ||
      !publicHtml.includes('"@type":"WebSite"')) {
    throw new Error('SEO: initial public homepage response has invalid crawler metadata');
  }
  for (const route of ['/dashboard', '/admin', '/login', '/register', '/forgot-password',
    '/demo', '/demo/student', '/demo/admin']) {
    const response = await fetch(`${baseUrl}${route}`, { signal: AbortSignal.timeout(3500) });
    const html = await response.text();
    if (response.status !== 200 ||
        !response.headers.get('x-robots-tag')?.includes('noindex') ||
        !html.includes('name="robots" content="noindex') ||
        html.includes('rel="canonical"')) {
      throw new Error(`SEO: leaked indexable private/demo route ${route}`);
    }
  }
  const notFoundPage = await fetch(`${baseUrl}/unrecognized-content`, { signal: AbortSignal.timeout(3500) });
  if (notFoundPage.status !== 404 || !notFoundPage.headers.get('x-robots-tag')?.includes('noindex')) {
    throw new Error('SEO: unknown SPA URL was indexable or did not return HTTP 404');
  }
  const guide = await fetch(`${baseUrl}/guide/`, { signal: AbortSignal.timeout(3500) });
  const guideHtml = await guide.text();
  if (guide.status !== 200 || !guideHtml.includes('چک‌لیست') || !guideHtml.includes('<h1>')) {
    throw new Error('SEO: static Persian selection guide was missing on Express');
  }
  const redirect = await fetch(`${baseUrl}/index.html`, { redirect: 'manual', signal: AbortSignal.timeout(3500) });
  if (redirect.status !== 308 || redirect.headers.get('location') !== '/') {
    throw new Error('SEO: index.html duplicate was not permanently redirected to homepage');
  }
  const robots = await fetch(`${baseUrl}/robots.txt`, { signal: AbortSignal.timeout(3500) }).then(r => r.text());
  const sitemap = await fetch(`${baseUrl}/sitemap.xml`, { signal: AbortSignal.timeout(3500) }).then(r => r.text());
  if (!robots.includes('Sitemap: https://darschin.example/sitemap.xml') ||
      !sitemap.includes('https://darschin.example/guide/') ||
      sitemap.includes('/dashboard') || sitemap.includes('/admin')) {
    throw new Error('SEO: verified crawler files did not match the public-only sitemap');
  }

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

  // Exercise the REAL root-authorized backup/restore API on a disposable
  // student-free production fixture. Never use this against a live database.
  const adminBackup = await requestJson('/api/admin/backup', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (adminBackup.status !== 200 || !Array.isArray(adminBackup.body?.courses) ||
      'smsSettings' in adminBackup.body ||
      !Array.isArray(adminBackup.body?.smsHistory) || adminBackup.body.smsHistory.length !== 0) {
    throw new Error('SECURITY: administrative backup leaked provider configuration or is malformed');
  }
  const submitRestore = (body) => requestJson('/api/admin/restore', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });
  const invalidRestore = await submitRestore({
    ...adminBackup.body,
    courses: [{ id: 'course-duplicate' }, { id: 'course-duplicate' }],
  });
  if (invalidRestore.status !== 400) {
    throw new Error('SECURITY: invalid backup was not rejected before writing student data');
  }
  const validRestore = await submitRestore(adminBackup.body);
  if (validRestore.status !== 200 ||
      !validRestore.body?.message?.includes('برنامه‌ها')) {
    throw new Error('Safe academic catalogue restore failed or hid its non-destructive scope');
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

  // Reproduce a fatal startup after initialization without touching the VPS.
  // The previous entrypoint logged a failed bootstrap but exited with code 0,
  // preventing systemd and deploy gates from recognizing the error.
  await stopServer();
  const invalidServer = spawn(process.execPath, [binary], {
    cwd: root,
    env: { ...environment, PORT: 'invalid-port' },
    stdio: 'ignore',
  });
  const badStatus = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      invalidServer.kill('SIGKILL');
      reject(new Error('Invalid startup did not exit within five seconds'));
    }, 5000);
    invalidServer.once('error', error => {
      clearTimeout(timeout);
      reject(error);
    });
    invalidServer.once('exit', (code, signal) => {
      clearTimeout(timeout);
      resolve({ code, signal });
    });
  });
  if (badStatus.code !== 1 || badStatus.signal !== null) {
    throw new Error('SECURITY: failed server bootstrap returned success instead of exit code 1');
  }

  // Fail closed if the expected volume is unmounted / a wrong data path is
  // configured. Never regenerate an empty database behind a student's back.
  async function assertRejectedDatabaseBoot(dataDir, label) {
    const child = spawn(process.execPath, [binary], {
      cwd: root,
      env: {
        ...environment,
        DARSCHYN_DATA_DIR: dataDir,
        DARSCHYN_REQUIRE_EXISTING_DB: 'true',
        PORT: String(port),
      },
      stdio: 'ignore',
    });
    const outcome = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        child.kill('SIGKILL');
        reject(new Error(`${label} unexpectedly remained alive`));
      }, 5000);
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('exit', (code, signal) => { clearTimeout(timeout); resolve({ code, signal }); });
    });
    if (outcome.code !== 1 || outcome.signal !== null) {
      throw new Error(`${label} must exit with status 1, not silently start an empty database`);
    }
  }

  const missingStore = path.join(temporary, 'missing-store');
  // Simulate an unmounted volume: neither the DB nor its directory exists.
  await assertRejectedDatabaseBoot(missingStore, 'Missing mounted DB');
  if (fs.existsSync(missingStore)) {
    throw new Error('SECURITY: a detached data mountpoint was silently recreated');
  }

  const corruptStore = path.join(temporary, 'corrupt-store');
  fs.mkdirSync(corruptStore);
  const corruptFile = path.join(corruptStore, 'darschyn-db.json');
  const invalidBytes = '{"users": [BROKEN-JSON';
  fs.writeFileSync(corruptFile, invalidBytes);
  await assertRejectedDatabaseBoot(corruptStore, 'Corrupt existing DB');
  if (fs.readFileSync(corruptFile, 'utf8') !== invalidBytes) {
    throw new Error('SECURITY: corrupt original data was overwritten instead of preserved');
  }

  // Production bootstrap must never turn an unrelated student into root
  // because their mobile collides with ROOT_OWNER_MOBILE. Exercise the actual
  // bundled Express startup, not only the pure identity resolver.
  const collisionStore = path.join(temporary, 'root-number-collision');
  fs.mkdirSync(collisionStore);
  const collisionFile = path.join(collisionStore, 'darschyn-db.json');
  const originalStore = JSON.parse(fs.readFileSync(
    path.join(environment.DARSCHYN_DATA_DIR, 'darschyn-db.json'), 'utf8',
  ));
  originalStore.users.push({
    id: 'usr-synthetic-collision',
    mobile: rootMobile,
    name: 'Synthetic account that must stay student',
    roles: ['student'],
    createdAt: new Date().toISOString(),
  });
  const collisionBytes = JSON.stringify(originalStore);
  fs.writeFileSync(collisionFile, collisionBytes);
  await assertRejectedDatabaseBoot(collisionStore, 'Root mobile/student identity collision');
  if (fs.readFileSync(collisionFile, 'utf8') !== collisionBytes) {
    throw new Error('SECURITY: failed root bootstrap unexpectedly modified stored accounts');
  }

  console.log('PASS: SEO HTTP metadata, private noindex, public guide, robots/sitemap, health, JSON 404, CAPTCHA login, safe catalogue restore, private API, restart persistence, invalid startup and storage guards.');
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
