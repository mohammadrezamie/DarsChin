import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

// فقط رابط کاربری و دادهٔ ساختگی؛ هیچ ENV خصوصی یا بستهٔ سرور منتشر نمی‌شود.
const base = '/DarsChin/';
execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--base=' + base], {
  stdio: 'inherit',
  env: { ...process.env, VITE_STATIC_PREVIEW: 'true' },
});
// مسیرهای ریشه در نسخهٔ اصلی دست‌نخورده می‌مانند؛ فقط خروجی Pages اصلاح می‌شود.
const index = readFileSync('dist/index.html', 'utf8')
  .replace('href="/manifest.webmanifest"', 'href="' + base + 'manifest.webmanifest"')
  .replace('href="/app-icon.svg"', 'href="' + base + 'app-icon.svg"');
writeFileSync('dist/index.html', index);
if (!index.includes('/DarsChin/assets/') ||
    !index.includes('/DarsChin/manifest.webmanifest')) {
  throw new Error('Static preview path validation failed.');
}
// نصب اختیاری PWA نیز باید فقط داخل مسیر همین دموی عمومی باز شود.
const path = 'dist/manifest.webmanifest';
if (existsSync(path)) {
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  manifest.id = base;
  manifest.scope = base;
  manifest.start_url = base + '#/demo/student';
  manifest.icons = (manifest.icons ?? []).map(icon => ({
    ...icon,
    src: base + (String(icon.src).startsWith('/') ? String(icon.src).slice(1) : String(icon.src)),
  }));
  manifest.shortcuts = [];
  writeFileSync(path, JSON.stringify(manifest, null, 2) + '\n');
}
writeFileSync('dist/.nojekyll', '');
console.log('پیش‌نمایش مستقل درس‌چین برای GitHub Pages ساخته شد.');
