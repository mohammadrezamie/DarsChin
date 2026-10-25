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
        console.log("Testing Student Registration...");
        const reg = await post('/api/auth/register', { mobile: '09123456789', password: 'password123', name: 'Test Student' });
        console.log("Register:", reg.status, reg.body.data?.user?.roles);

        // We can't easily test login because of CAPTCHA/OTP requirement.
        // Wait, the API requires OTP. 
        console.log("Done.");
    } catch (e) {
        console.error(e);
    }
})();
