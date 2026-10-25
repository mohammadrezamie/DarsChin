const fs = require('fs');
const db = JSON.parse(fs.readFileSync('./data/darschyn-db.json', 'utf8'));
const root = db.users.find(u => u.roles.includes('super-admin') || u.id === 'usr-super');
console.log(root ? "ROOT FOUND: " + root.mobile : "NO ROOT");
