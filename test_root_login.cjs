const http = require('http');

const post = (path, data) => new Promise((resolve, reject) => {
    const req = http.request({
        hostname: '127.0.0.1',
        port: 3000,
        path,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(JSON.stringify(data))
        }
    }, res => {
        let body = '';
        res.on('data', d => body += d);
        res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body || '{}') }));
    });
    req.on('error', reject);
    req.write(JSON.stringify(data));
    req.end();
});

(async () => {
    try {
        console.log("Testing Root Login...");
        const res = await post('/api/auth/login', { mobile: '09911902465', password: 'mMhrad840' });
        console.log("Login:", res.status, res.body.success, res.body.data?.user?.roles);
    } catch (e) {
        console.error(e);
    }
})();
