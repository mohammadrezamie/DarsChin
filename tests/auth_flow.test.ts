import { db } from '../server/db/database';
import assert from 'assert';

async function runAuthTests() {
  await db.init(true);
  const baseUrl = 'http://localhost:3000/api/auth';
  const adminBaseUrl = 'http://localhost:3000/api/admin';

  console.log('--- TEST 1: Super Admin Login ---');
  const superAdminRes = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile: '09911902465', password: 'admin123' }),
  });
  const superAdminData = await superAdminRes.json();
  console.log('Super Admin login status:', superAdminRes.status, superAdminData.success);
  assert.strictEqual(superAdminRes.status, 200);
  assert.strictEqual(superAdminData.success, true);
  assert(superAdminData.data.user.roles.includes('super-admin'));
  const superAdminToken = superAdminData.data.token;

  console.log('--- TEST 2: Student Registration (Mobile + Password) ---');
  const testMobile = `0912${Math.floor(1000000 + Math.random() * 9000000)}`;
  const regRes = await fetch(`${baseUrl}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mobile: testMobile,
      password: 'MyPassword123',
      name: 'دانشجوی آزمایشی',
      recoveryKey: 'my-secret-recovery-key',
    }),
  });
  const regData = await regRes.json();
  console.log('Registration status:', regRes.status, regData.success);
  assert.strictEqual(regRes.status, 201);
  assert.strictEqual(regData.success, true);
  assert.strictEqual(regData.data.user.roles.length, 1);
  assert.strictEqual(regData.data.user.roles[0], 'student');
  const studentToken = regData.data.token;

  console.log('--- TEST 3: Student Login with Password ---');
  const loginRes = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile: testMobile, password: 'MyPassword123' }),
  });
  const loginData = await loginRes.json();
  console.log('Student login status:', loginRes.status, loginData.success);
  assert.strictEqual(loginRes.status, 200);
  assert.strictEqual(loginData.success, true);

  console.log('--- TEST 4: Student Login with Wrong Password (Expected 401) ---');
  const wrongRes = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile: testMobile, password: 'WrongPassword' }),
  });
  console.log('Wrong password status:', wrongRes.status);
  assert.strictEqual(wrongRes.status, 401);

  console.log('--- TEST 5: Change Password ---');
  const changeRes = await fetch(`${baseUrl}/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${studentToken}`,
    },
    body: JSON.stringify({
      currentPassword: 'MyPassword123',
      newPassword: 'BrandNewPassword456',
    }),
  });
  const changeData = await changeRes.json();
  console.log('Change password status:', changeRes.status, changeData.success);
  assert.strictEqual(changeRes.status, 200);
  assert.strictEqual(changeData.success, true);

  console.log('--- TEST 6: Login with New Password ---');
  const newLoginRes = await fetch(`${baseUrl}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mobile: testMobile, password: 'BrandNewPassword456' }),
  });
  assert.strictEqual(newLoginRes.status, 200);

  console.log('--- TEST 7: Password Recovery ---');
  const recoverRes = await fetch(`${baseUrl}/recover-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      mobile: testMobile,
      recoveryKey: 'my-secret-recovery-key',
      newPassword: 'RecoveredPassword789',
    }),
  });
  const recoverData = await recoverRes.json();
  console.log('Password recovery status:', recoverRes.status, recoverData.success);
  assert.strictEqual(recoverRes.status, 200);
  assert.strictEqual(recoverData.success, true);

  console.log('--- TEST 8: Role Authorization (Student blocked from admin route, Super Admin allowed) ---');
  const studentAdminAccess = await fetch(`${adminBaseUrl}/users`, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  console.log('Student accessing /api/admin/users status (expected 403):', studentAdminAccess.status);
  assert.strictEqual(studentAdminAccess.status, 403);

  const superAdminAccess = await fetch(`${adminBaseUrl}/users`, {
    headers: { Authorization: `Bearer ${superAdminToken}` },
  });
  const superAdminAccessBody = await superAdminAccess.text();
  console.log('Super Admin accessing /api/admin/users status:', superAdminAccess.status, superAdminAccessBody);
  assert.strictEqual(superAdminAccess.status, 200);

  console.log('✅ ALL MOBILE + PASSWORD AUTH TESTS PASSED SUCCESSFULLY!');
}

runAuthTests().catch((err) => {
  console.error('❌ Auth test error:', err);
  process.exit(1);
});
