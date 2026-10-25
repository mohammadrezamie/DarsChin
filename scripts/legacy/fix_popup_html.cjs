const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'extension/popup.html');
let content = fs.readFileSync(file, 'utf-8');

const injection = `
    <!-- Sync Config -->
    <div class="card flex flex-col gap-2">
        <label class="text-xs font-semibold text-slate-300">توکن همگام‌سازی (Sync Token)</label>
        <input type="text" id="syncTokenInput" class="w-full bg-slate-900 border border-slate-700 text-white rounded-lg p-2 text-xs" placeholder="توکن را از پنل درس‌چین دریافت کنید" />
    </div>
`;
if (!content.includes('syncTokenInput')) {
    content = content.replace("<!-- Main Action -->", injection + "\n    <!-- Main Action -->");
    fs.writeFileSync(file, content);
}
