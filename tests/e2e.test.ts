async function e2e() {
  const baseUrl = 'http://localhost:3000/api';
  const post = async (path: string, body: any, token = '') => {
    const r = await fetch(`${baseUrl}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    if (!r.ok) { console.log("ERROR POST", path, r.status, await r.text()); return null; }
    else return r.json();
  };
  const put = async (path: string, body: any, token = '') => {
    const r = await fetch(`${baseUrl}${path}`, { method: 'PUT', headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) }, body: JSON.stringify(body) });
    if (!r.ok) { console.log("ERROR PUT", path, r.status, await r.text()); return null; }
    else return r.json();
  };
  const get = async (path: string, token = '') => {
    const r = await fetch(`${baseUrl}${path}`, { method: 'GET', headers: { 'Content-Type': 'application/json', ...(token ? { 'Authorization': `Bearer ${token}` } : {}) } });
    if (!r.ok) { console.log("ERROR GET", path, r.status, await r.text()); return null; }
    else return r.json();
  };

  const ts = Date.now();
  console.log("=== STARTING IAU E2E TEST ===");

  const loginRes = await post('/auth/login', { email: 'admin@darschyn.ir', password: 'admin123' });
  const adminToken = loginRes?.data?.token;

  let prov = await post('/academic/provinces', { name: 'استان تست ' + ts }, adminToken);
  const provId = prov?.data?.id;

  let campus = await post('/academic/campuses', { universityId: 'univ-azad', provinceId: provId, type: 'PROVINCE_UNIT', name: 'واحد تست ' + ts, code: 'UTST' + ts }, adminToken);
  const campusId = campus?.data?.id;

  let deg = await post('/academic/degrees', { name: 'کارشناسی ' + ts, code: 'BS' + ts }, adminToken);
  const degId = deg?.data?.id;

  let major = await post('/academic/majors', { degreeLevelId: degId, name: 'مهندسی تست', code: 'ENG' + ts }, adminToken);
  const majorId = major?.data?.id;

  let track = await post('/academic/tracks', { majorId: majorId, name: 'گرایش یک', code: 'TR1' + ts }, adminToken);
  const trackId = track?.data?.id;

  let curr = await post('/curriculum', {
    universityId: 'univ-azad', campusId, degreeLevelId: degId, majorId, entryYearId: 'ey-1403',
    name: 'چارت تست ' + ts, version: 'v1'
  }, adminToken);
  const currId = curr?.data?.id;

  let c1 = await post('/academic/courses', { code: 'C100_' + ts, name: 'ریاضی ۱ تست', units: 3, category: 'پایه' }, adminToken);
  let c2 = await post('/academic/courses', { code: 'C101_' + ts, name: 'ریاضی ۲ تست', units: 3, category: 'پایه' }, adminToken);
  
  await post(`/curriculum/${currId}/courses`, { courseId: c1?.data?.id, suggestedSemester: 1, isRequired: true, isElective: false }, adminToken);
  await post(`/curriculum/${currId}/courses`, { courseId: c2?.data?.id, suggestedSemester: 2, isRequired: true, isElective: false }, adminToken);

  await post(`/curriculum/${currId}/prerequisites`, {
    courseId: c2?.data?.id, prerequisiteCourseId: c1?.data?.id, conditionType: 'AND'
  }, adminToken);

  const stuLogin = await post('/auth/login', { email: 'student@darschyn.ir', password: 'student123' });
  const stuToken = stuLogin?.data?.token;

  await put('/student/profile', {
    universityId: 'univ-azad', provinceId: provId, campusId: campusId, degreeLevelId: degId, majorId: majorId, entryYearId: 'ey-1403',
    isTrackSelected: true, selectedTrackId: trackId, desiredTrackIds: []
  }, stuToken);

  const mockPayload = {
    schemaVersion: '1.0', source: 'darschyn-chrome-extension', extractedAt: new Date().toISOString(), term: 'term-4031',
    records: [
      { courseCode: 'C100_' + ts, courseName: 'ریاضی ۱ تست', group: '01', instructor: 'استاد الف' },
      { courseCode: 'C101_' + ts, courseName: 'ریاضی ۲ تست', group: '01', instructor: 'استاد ب' }
    ]
  };

  await post('/imports/process', {
    payload: mockPayload,
    termId: 'term-1405-1',
    campusId: campusId
  }, stuToken);
  
  const evalRes = await post('/eligibility/evaluate', {}, stuToken);
  const evalC1 = evalRes?.data?.report?.results?.find((r:any) => r.courseCode === 'C100_' + ts);
  const evalC2 = evalRes?.data?.report?.results?.find((r:any) => r.courseCode === 'C101_' + ts);
  
  console.log("Math 1 Status:", evalC1?.overallStatus); // Expected: AVAILABLE
  console.log("Math 2 Status:", evalC2?.overallStatus); // Expected: BLOCKED_PREREQUISITE

  // Super Admin test
  const superRes = await post('/auth/login', { email: 'super@darschyn.ir', password: 'changeme123' });
  const superToken = superRes?.data?.token;
  if (!superToken) console.log("SUPER ADMIN LOGIN FAILED");
  
  const usersList = await get('/admin/users', superToken);
  console.log("Super Admin retrieved users count:", usersList?.data?.length);

  if (evalC1?.overallStatus === 'AVAILABLE' && evalC2?.overallStatus === 'BLOCKED_PREREQUISITE' && usersList?.data?.length > 0) {
    console.log("=== IAU E2E TEST PASSED ===");
  } else {
    console.log("=== IAU E2E TEST FAILED ===");
  }
}
e2e().catch(console.error);
