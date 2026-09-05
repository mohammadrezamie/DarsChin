const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const zip = new AdmZip();
zip.addLocalFolder('extension', '');
const outPath = `darschyn-chrome-extension-v${pkg.version}.zip`;

// Remove old zips
fs.readdirSync('.').forEach(f => {
    if (f.startsWith('darschyn-chrome-extension-v') && f.endsWith('.zip')) {
        fs.unlinkSync(f);
    }
});

zip.writeZip(outPath);
console.log(`Created ${outPath}`);
