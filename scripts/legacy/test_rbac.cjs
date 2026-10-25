const http = require('http');

const post = (path, data, token='') => new Promise((resolve) => {
    const headers = {'Content-Type': 'application/json'};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const req = http.request({ hostname: '127.0.0.1', port: 3000, path, method: 'POST', headers }, res => {
        let b = ''; res.on('data', d => b+=d); res.on('end', () => resolve({s: res.statusCode, b: JSON.parse(b||'{}')}));
    });
    req.write(JSON.stringify(data)); req.end();
});
const get = (path, token='') => new Promise((resolve) => {
    const headers = {};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const req = http.request({ hostname: '127.0.0.1', port: 3000, path, method: 'GET', headers }, res => {
        let b = ''; res.on('data', d => b+=d); res.on('end', () => resolve({s: res.statusCode, b: JSON.parse(b||'{}')}));
    });
    req.end();
});

(async () => {
    // 1. Logins
    const stu = await post('/api/auth/login', {mobile: '09120000000', password: 'student123'});
    console.log("Student login:", stu.s === 200 ? "PASS" : "FAIL");
    
    const adm = await post('/api/auth/login', {mobile: '09121111111', password: '1010'});
    console.log("Admin login:", adm.s === 200 ? "PASS" : "FAIL");
    
    const root = await post('/api/auth/login', {mobile: '09911902465', password: 'mMhrad840'});
    console.log("Root login:", root.s === 200 ? "PASS" : "FAIL");

    const bad = await post('/api/auth/login', {mobile: '09120000000', password: 'wrong'});
    console.log("Wrong password:", bad.s === 401 ? "PASS" : "FAIL");

    const invalidJwt = await get('/api/auth/me', 'invalid-token-123');
    console.log("Invalid JWT:", invalidJwt.s === 401 ? "PASS" : "FAIL");

    const noAuth = await get('/api/auth/me');
    console.log("Missing auth:", noAuth.s === 401 ? "PASS" : "FAIL");

    // 2. RBAC Tests
    const stuToken = stu.b.data.token;
    const admToken = adm.b.data.token;
    const rootToken = root.b.data.token;

    const stuToAdmin = await get('/api/admin/users', stuToken);
    console.log("Student -> Admin:", stuToAdmin.s === 403 ? "PASS" : "FAIL");

    const admNoPerm = await get('/api/support/tickets', admToken);
    // Assuming admin doesn't have support.manage by default, or if it does, 200 is fine.
    // Let's check a super-admin specific route, like admin management.
    const admEscalate = await post('/api/admin-management/users/usr-student-1/roles', {role: 'super-admin'}, admToken);
    console.log("Delegated admin escalation:", admEscalate.s === 403 ? "PASS" : "FAIL");

    const rootFull = await get('/api/admin/users', rootToken);
    console.log("Root full access:", rootFull.s === 200 ? "PASS" : "FAIL");
})();
