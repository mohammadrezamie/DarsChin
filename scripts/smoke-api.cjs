// Production-mode, disposable API smoke test. No real accounts, network dependencies or mutable project data.
const crypto = require('node:crypto');
const fs = require('node:fs');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { spawn, spawnSync } = require('node:child_process');

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
  DARSCHYN_ACCESS_MODE: 'multiuser',
  DARSCHYN_REGISTRATION_OTP_REQUIRED: 'false',
  SMS_PROVIDER: 'log',
  JWT_SECRET: crypto.randomBytes(32).toString('hex'),
  DARSCHYN_RELEASE_SHA: testReleaseSha,
  ROOT_OWNER_MOBILE: rootMobile,
  ROOT_OWNER_PASSWORD: rootPassword,
  ROOT_OWNER_RECOVERY_KEY: crypto.randomBytes(32).toString('hex'),
  // Exercise the real self-hosted fallback; never depend on a live CAPTCHA key.
  TURNSTILE_ENABLED: 'false',
};
delete environment.NIAZPARDAZ_API_KEY;
delete environment.MOCK_OTP_CODE;

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

  // سناریوی واقعی نیازسنجی روی دادهٔ کاملاً مصنوعی و فرایند production.
  // حساب‌ها فقط در فایل موقت همین آزمون، وقتی سرویس خاموش است، ایجاد می‌شوند.
  // هیچ مسیر ثبت‌نام یا احراز هویت production برای تست تغییر نمی‌کند.
  await stopServer();
  let fixturePath = path.join(environment.DARSCHYN_DATA_DIR, 'darschyn-db.json');
  if (path.dirname(fixturePath) !== path.join(temporary, 'data')) throw new Error('Unsafe smoke fixture path');
  const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const chart = fixture.curricula.find(c => c.status === 'active' &&
    fixture.entryYears.some(y => y.id === c.entryYearId && y.active) &&
    fixture.curriculumCourses.some(cc => cc.curriculumId === c.id && cc.active !== false &&
      !cc.trackId && fixture.courses.some(course => course.id === cc.courseId && course.active)));
  if (!chart) throw new Error('Missing synthetic active curriculum');
  const courseId = fixture.curriculumCourses.find(cc => cc.curriculumId === chart.id &&
    cc.active !== false && !cc.trackId &&
    fixture.courses.some(course => course.id === cc.courseId && course.active)).courseId;
  const termId = fixture.academicTerms.find(t => t.active)?.id;
  const alternateYear = fixture.entryYears.find(y => y.active && y.id !== chart.entryYearId)?.id;
  if (!termId || !alternateYear) throw new Error('Missing synthetic term or second cohort');
  const password = crypto.randomBytes(24).toString('hex');
  const bcrypt = require('bcryptjs');
  const createdAt = new Date().toISOString();
  const academicScope = { universityId: chart.universityId, campusId: chart.campusId,
    degreeLevelId: chart.degreeLevelId, majorId: chart.majorId, entryYearId: chart.entryYearId };
  const accounts = [
    {id:'smoke-demand-student',mobile:'09999999991',name:'دانشجوی مصنوعی',roles:['student']},
    {id:'smoke-demand-other',mobile:'09999999992',name:'ورودی دیگر مصنوعی',roles:['student']},
    {id:'smoke-demand-manager',mobile:'09999999993',name:'مدیر محدود مصنوعی',roles:['admin'],
      permissions:['demand.manage'],demandScopes:[{campusId:chart.campusId,
        degreeLevelId:chart.degreeLevelId,majorId:chart.majorId}]},
  ];
  for (const account of accounts) {
    if (fixture.users.some(u => u.id === account.id || u.mobile === account.mobile)) throw new Error('Synthetic fixture identity collision');
    fixture.users.push({...account,password:bcrypt.hashSync(password,10),createdAt});
  }
  fs.writeFileSync(fixturePath, JSON.stringify(fixture), {mode:0o600});
  environment.DARSCHYN_REQUIRE_EXISTING_DB = 'true';
  await startServer();

  async function fixtureLogin(account) {
    const challenge = await requestJson('/api/auth/otp/captcha/generate?action=login');
    const saved = JSON.parse(fs.readFileSync(fixturePath,'utf8')).captchaChallenges
      .find(row => row.id === challenge.body?.data?.id && row.action === 'login');
    if (challenge.status !== 200 || !saved || typeof saved.value !== 'string') throw new Error('Synthetic login challenge unavailable');
    const result = await requestJson('/api/auth/login', {
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({mobile:account.mobile,password,captchaToken:'local:'+saved.id+':'+saved.value}),
    });
    if (result.status !== 200 || typeof result.body?.data?.token !== 'string') throw new Error('Synthetic demand account login failed');
    return result.body.data.token;
  }
  const studentToken = await fixtureLogin(accounts[0]);
  const otherToken = await fixtureLogin(accounts[1]);
  const managerToken = await fixtureLogin(accounts[2]);
  const authenticated = (route, accessToken, method='GET', body) => requestJson(route, {
    method, headers:{Authorization:'Bearer '+accessToken,'Content-Type':'application/json'},
    ...(body === undefined ? {} : {body:JSON.stringify(body)}),
  });
  const expectStatus = (result, status, label) => {
    if (result.status !== status) throw new Error(label+' expected HTTP '+status+', got '+result.status);
    return result.body;
  };
  const profile = {...academicScope,currentTermId:termId,isTrackSelected:false,desiredTrackIds:[]};
  expectStatus(await authenticated('/api/student/profile',studentToken,'PUT',profile),200,'Student profile');
  expectStatus(await authenticated('/api/student/profile',otherToken,'PUT',{...profile,entryYearId:alternateYear}),200,'Other cohort profile');
  const questions = [
    {id:'preference',kind:'single_choice',title:'زمان مطلوب',required:true,options:['صبح','عصر']},
    {id:'detail',kind:'short_text',title:'توضیح تکمیلی',required:true,
      visibleWhen:{questionId:'preference',equals:'صبح'}},
  ];
  const draft = expectStatus(await authenticated('/api/demand/surveys',managerToken,'POST',{
    universityId:chart.universityId,campusId:chart.campusId,degreeLevelId:chart.degreeLevelId,
    majorId:chart.majorId,entryYearIds:[chart.entryYearId],curriculumId:chart.id,
    title:'نیازسنجی آزمون عملیاتی',description:'فقط داده مصنوعی',
    targetTermId:termId,trackIds:[],courseIds:[courseId],
    recommendedMinimumByCourse:{[courseId]:1},questions,
  }),201,'Create demand draft');
  const demandId = draft.data?.id;
  if (typeof demandId !== 'string' || draft.data.status !== 'DRAFT') throw new Error('Draft identity or state invalid');
  const demandPath = '/api/demand/surveys/'+encodeURIComponent(demandId);
  const listFor = async accessToken => expectStatus(await authenticated('/api/demand/surveys',accessToken),200,'Survey list').data;
  if ((await listFor(studentToken)).some(s=>s.id===demandId)) throw new Error('Draft visible to student');
  expectStatus(await authenticated(demandPath+'/status',managerToken,'PUT',{status:'OPEN'}),200,'Open demand');
  if (!(await listFor(studentToken)).some(s=>s.id===demandId) ||
      (await listFor(otherToken)).some(s=>s.id===demandId)) throw new Error('Demand cohort isolation failed');

  const studentNumber='1405000001';
  const baseAnswer={studentNumber,anticipatedGraduation:'YES',courseIds:[courseId]};
  expectStatus(await authenticated(demandPath+'/response',otherToken,'PUT',{...baseAnswer,answers:{preference:'عصر'}}),404,'Other cohort submission');
  expectStatus(await authenticated(demandPath+'/response',studentToken,'PUT',{...baseAnswer,answers:{preference:'صبح'}}),400,'Missing conditional answer');
  const first=expectStatus(await authenticated(demandPath+'/response',studentToken,'PUT',{
    ...baseAnswer,answers:{preference:'صبح',detail:'متن محرمانه مصنوعی'},
  }),200,'First demand response');
  const privateDenied=await authenticated(demandPath+'/answers.csv?format=json',managerToken);
  expectStatus(privateDenied,403,'Private export denied before response edit');
  const reportBeforeEdit=expectStatus(await authenticated(demandPath+'/report',managerToken),200,'Initial aggregate').data;
  if (reportBeforeEdit.participantCount!==1 || reportBeforeEdit.byCourse?.[0]?.count!==1 ||
      JSON.stringify(reportBeforeEdit).includes(studentNumber) ||
      JSON.stringify(reportBeforeEdit).includes('متن محرمانه مصنوعی')) throw new Error('Initial aggregate privacy or count failed');
  const privateExport=expectStatus(await authenticated(demandPath+'/answers.csv?format=json',token),200,'Root private export').data?.csv;
  if (typeof privateExport!=='string' || !privateExport.includes(studentNumber) ||
      !privateExport.includes('متن محرمانه مصنوعی')) throw new Error('Authorized private export failed');
  expectStatus(await authenticated(demandPath+'/response',studentToken,'PUT',{
    ...baseAnswer,answers:{preference:'عصر',detail:'پاسخ پنهان'},
  }),400,'Hidden answer rejection');
  const edited=expectStatus(await authenticated(demandPath+'/response',studentToken,'PUT',{
    ...baseAnswer,courseIds:[],anticipatedGraduation:'NO',answers:{preference:'عصر'},
  }),200,'Replace demand response');
  if (edited.data?.id !== first.data?.id || edited.data?.answers?.detail !== undefined) throw new Error('Response replacement failed');
  expectStatus(await authenticated(demandPath+'/report',studentToken),403,'Student report denied');
  expectStatus(await authenticated(demandPath+'/answers.csv?format=json',managerToken),403,'Private answers denied to scoped manager');
  async function verifyDemandPersistence() {
    const report=expectStatus(await authenticated(demandPath+'/report',managerToken),200,'Demand aggregate report').data;
    if (report.participantCount!==1 || report.byCourse?.[0]?.count!==0 ||
        report.byQuestion?.find(q=>q.id==='preference')?.options?.find(o=>o.label==='عصر')?.count!==1 ||
        JSON.stringify(report).includes(studentNumber)) throw new Error('Aggregate response inconsistent or exposed identity');
    const csv=expectStatus(await authenticated(demandPath+'/questions.csv?format=json',managerToken),200,'Question aggregate export').data?.csv;
    if (typeof csv !== 'string' || !csv.includes('عصر') || csv.includes(studentNumber) || csv.includes('متن محرمانه مصنوعی')) throw new Error('Aggregate CSV inconsistent or exposed private data');
    const own=expectStatus(await authenticated(demandPath+'/response',studentToken),200,'Own demand response').data;
    if (own?.id!==first.data.id || own?.courseIds?.length!==0 || own?.answers?.preference!=='عصر' ||
        own?.answers?.detail!==undefined) throw new Error('Own response did not survive replacement or restart');
  }
  await verifyDemandPersistence();
  expectStatus(await authenticated(demandPath+'/status',managerToken,'PUT',{status:'CLOSED'}),200,'Close demand');
  expectStatus(await authenticated(demandPath+'/response',studentToken,'PUT',{...baseAnswer,answers:{preference:'عصر'}}),409,'Closed survey submission');

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

  await verifyDemandPersistence();
  expectStatus(await authenticated(demandPath+'/response',studentToken,'PUT',{...baseAnswer,answers:{preference:'عصر'}}),409,'Closed survey remains closed after restart');
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

  // Verify actual production-mode logout persists across restart, without logging tokens.
  expectStatus(await authenticated('/api/auth/logout',studentToken,'POST'),200,'Logout student');
  expectStatus(await authenticated('/api/auth/me',studentToken),401,'Revoked session');
  await stopServer();
  await startServer();
  expectStatus(await authenticated('/api/auth/me',studentToken),401,'Revocation survives restart');
  const newStudentToken=await fixtureLogin(accounts[0]);
  expectStatus(await authenticated('/api/auth/me',newStudentToken),200,'New session after logout');

  // Full disaster recovery drill: stop synthetic origin, create encrypted
  // snapshot, verify, restore to a separate directory and boot the real bundle.
  await stopServer();
  const drillStart=Date.now();
  const originalPath=fixturePath;
  const originalBytes=fs.readFileSync(originalPath);
  const privateDir=name=>{
    const directory=path.join(temporary,name);
    fs.mkdirSync(directory,{mode:0o700});
    return directory;
  };
  const keyFile=path.join(privateDir('backup-key'),'snapshot.key');
  const archive=path.join(privateDir('encrypted-archive'),'snapshot.dcb');
  const restoredDir=privateDir('restored-data');
  const restoredFile=path.join(restoredDir,'darschyn-db.json');
  fs.writeFileSync(keyFile,crypto.randomBytes(32),{mode:0o600,flag:'wx'});
  const offline=(...args)=>{
    const result=spawnSync('bun',['run','scripts/offline-backup.ts',...args],{
      cwd:root,env:{...environment,DARSCHYN_OFFLINE_MAINTENANCE_CONFIRMED:'true'},
      stdio:'ignore',timeout:15000,
    });
    if(result.error||result.status!==0)throw new Error('Offline disaster recovery step failed: '+args[0]);
  };
  offline('backup',originalPath,keyFile,archive);
  offline('verify',archive,keyFile);
  offline('restore-new',archive,keyFile,restoredFile);
  if(!fs.readFileSync(restoredFile).equals(originalBytes))throw new Error('Snapshot restore differs from source bytes');
  if(!fs.readFileSync(originalPath).equals(originalBytes))throw new Error('Snapshot source was modified');
  environment.DARSCHYN_DATA_DIR=restoredDir;
  environment.DARSCHYN_REQUIRE_EXISTING_DB='true';
  fixturePath=restoredFile;
  // Never reuse a pre-disaster signing secret when bringing an old snapshot
  // back into service. This prevents resurrection of revoked JWT sessions.
  environment.JWT_SECRET=crypto.randomBytes(32).toString('hex');
  await startServer();
  expectStatus(await authenticated('/api/auth/me',newStudentToken),401,'Pre-restore token rejected after key rotation');
  expectStatus(await authenticated('/api/auth/me',studentToken),401,'Previously revoked token rejected after recovery');
  const restoredStudent=await fixtureLogin(accounts[0]);
  const restoredManager=await fixtureLogin(accounts[2]);
  const restoredOther=await fixtureLogin(accounts[1]);
  const recovered=expectStatus(await authenticated(demandPath+'/response',restoredStudent),200,'Recovered student response').data;
  if(recovered?.id!==first.data.id||recovered?.answers?.preference!=='عصر'||recovered?.courseIds?.length!==0)throw new Error('Recovered student data mismatch');
  expectStatus(await authenticated(demandPath+'/response',restoredOther),404,'Recovered cohort isolation');
  expectStatus(await authenticated(demandPath+'/answers.csv?format=json',restoredManager),403,'Recovered private export boundary');
  const recoveredReport=expectStatus(await authenticated(demandPath+'/report',restoredManager),200,'Recovered aggregate').data;
  if(recoveredReport.participantCount!==1||JSON.stringify(recoveredReport).includes(studentNumber))throw new Error('Recovered report mismatch or privacy failure');
  expectStatus(await authenticated(demandPath+'/response',restoredStudent,'PUT',{...baseAnswer,answers:{preference:'عصر'}}),409,'Recovered closed survey');
  if(!fs.readFileSync(originalPath).equals(originalBytes))throw new Error('Recovery server modified original database');
  console.log('PASS: isolated encrypted snapshot recovery, real server boot, fresh authentication, access boundaries and source preservation; synthetic drill milliseconds='+ (Date.now()-drillStart));

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

  console.log('PASS: health, JSON 404, single-use CAPTCHA login, private API, scoped demand lifecycle and restart persistence, safe catalogue restore, protected reset, demo pages, restart persistence, invalid startup, missing-volume fail-closed, corrupted-database preservation and root identity conflict refusal, logout revocation and restart persistence.');
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
