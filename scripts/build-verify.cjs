const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

console.log("Running DARSCHYN Build Verification...");

const pkgPath = path.join(process.cwd(), 'package.json');
const manifestPath = path.join(process.cwd(), 'extension', 'manifest.json');
const contentJsPath = path.join(process.cwd(), 'extension', 'content.js');
const popupJsPath = path.join(process.cwd(), 'extension', 'popup.js');

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

const version = pkg.version;
console.log(`Package version: ${version}`);

if (manifest.version !== version) {
    console.error(`Manifest version (${manifest.version}) does not match package version (${version})`);
    process.exit(1);
}

const contentJs = fs.readFileSync(contentJsPath, 'utf8');
if (contentJs.length < 10000) {
    console.error(`content.js is suspiciously small (${contentJs.length} bytes)`);
    process.exit(1);
}

if (!contentJs.includes('chrome.runtime.onMessage.addListener')) {
    console.error(`content.js is missing message listener`);
    process.exit(1);
}

const zipFile = `darschyn-chrome-extension-v${version}.zip`;
if (!fs.existsSync(zipFile)) {
    console.error(`Zip file not found: ${zipFile}`);
    process.exit(1);
}

const zip = new AdmZip(zipFile);
const zipEntries = zip.getEntries().map(e => e.entryName);
if (!zipEntries.includes('manifest.json') || !zipEntries.includes('content.js') || !zipEntries.includes('popup.html')) {
    console.error(`Zip file is missing required files. Present files: ${zipEntries.join(', ')}`);
    process.exit(1);
}

console.log("✓ Build verification passed.");

try {
    const { execSync } = require('child_process');
    execSync('node --check extension/content.js', { stdio: 'ignore' });
    console.log("✓ content.js syntax check passed");
} catch (e) {
    console.error("Syntax check failed on extension/content.js");
    process.exit(1);
}
