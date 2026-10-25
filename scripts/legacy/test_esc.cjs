const http = require('http');
const post = (path, data, token='') => new Promise((resolve) => {
    const headers = {'Content-Type': 'application/json'};
    if (token) headers['Authorization'] = 'Bearer ' + token;
    const req = http.request({ hostname: '127.0.0.1', port: 3000, path, method: 'POST', headers }, res => {
        let b = ''; res.on('data', d => b+=d); res.on('end', () => resolve({s: res.statusCode, b: JSON.parse(b||'{}')}));
    });
    req.write(JSON.stringify(data)); req.end();
});
(async () => {
    const adm = await post('/api/auth/login', {mobile: '09121111111', password: '1010'});
    const admToken = adm.b.data.token;
    const admEscalate = await post('/api/admin-management/users/usr-student-1/roles', {role: 'super-admin'}, admToken);
    console.log("Status:", admEscalate.s, admEscalate.b);
})();
