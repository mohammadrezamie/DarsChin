const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

const zip = new AdmZip();
// Explicit manifest: never distribute accidental untracked .env, source maps,
// backups or credentials placed in the extension folder on a build machine.
const publicFiles = JSON.parse(fs.readFileSync(path.join('extension', 'public-files.json'), 'utf8'));
const seen = new Set();
for (const name of publicFiles) {
    if (typeof name !== 'string' || !/^[A-Za-z0-9_./-]+$/.test(name) ||
        name.startsWith('/') || name.split('/').some(part => !part || part === '.' || part === '..') ||
        seen.has(name)) throw new Error('Unsafe extension package manifest');
    seen.add(name);
    const target = path.join('extension', name);
    const info = fs.lstatSync(target);
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('Invalid public extension asset');
    zip.addFile(name, fs.readFileSync(target));
}
const outPath = `darschyn-chrome-extension-v${pkg.version}.zip`;

// Remove old zips
fs.readdirSync('.').forEach(f => {
    if (f.startsWith('darschyn-chrome-extension-v') && f.endsWith('.zip')) {
        fs.unlinkSync(f);
    }
});

zip.writeZip(outPath);
console.log(`Created ${outPath}`);
