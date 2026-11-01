const http = require('http');
const post = (path, data) => new Promise((resolve) => {
    const req = http.request({ hostname: '127.0.0.1', port: 3000, path, method: 'POST', headers: {'Content-Type': 'application/json'} }, res => {
        let b = ''; res.on('data', d => b+=d); res.on('end', () => resolve({s: res.statusCode, b: JSON.parse(b||'{}')}));
    });
    req.write(JSON.stringify(data)); req.end();
});
(async () => {
    const r1 = await post('/api/auth/login', { mobile: '09911902465', password: 'mMhrad840' });
    console.log("Root Login (Container Env):", r1.s === 200 ? "PASS" : "FAIL ("+r1.s+")");
    const r2 = await post('/api/auth/login', { mobile: '09121111111', password: '1010' });
    console.log("Admin Login (1010 seed):", r2.s === 200 ? "PASS" : "FAIL ("+r2.s+")");
})();
