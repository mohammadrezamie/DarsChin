const fs = require('fs');
const path = require('path');
const file = path.join(process.cwd(), 'extension/popup.js');
let content = fs.readFileSync(file, 'utf-8');

// Add token handling
const loadToken = `
    const syncTokenInput = document.getElementById('syncTokenInput');
    chrome.storage.local.get(['darschyn_sync_token'], (res) => {
        if (res.darschyn_sync_token) syncTokenInput.value = res.darschyn_sync_token;
    });
    syncTokenInput.addEventListener('input', (e) => {
        chrome.storage.local.set({ darschyn_sync_token: e.target.value });
    });
`;

if (!content.includes('syncTokenInput')) {
    content = content.replace("checkConnection();", "checkConnection();\n" + loadToken);
}

// Add API sync logic
const syncBtnHtml = `
        <button id="syncApiBtn" class="w-full mt-2 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors text-sm">
            همگام‌سازی مستقیم با سرور درس‌چین
        </button>
`;

const syncLogic = `
els.syncApiBtn = document.getElementById('syncApiBtn');
if (els.syncApiBtn) {
    els.syncApiBtn.addEventListener('click', async () => {
        if (!lastState || !lastState.exportData) return;
        const token = document.getElementById('syncTokenInput').value.trim();
        if (!token) {
            alert('لطفاً توکن همگام‌سازی را وارد کنید');
            return;
        }

        els.syncApiBtn.disabled = true;
        els.syncApiBtn.innerText = 'در حال ارسال...';

        try {
            // Start Job
            const jobRes = await fetch('http://localhost:3000/api/sync/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({ termId: lastState.term })
            });
            const jobData = await jobRes.json();
            if (!jobData.success) throw new Error(jobData.error);
            const jobId = jobData.data.id;

            // Send Snapshot
            const snapRes = await fetch('http://localhost:3000/api/sync/jobs/' + jobId + '/snapshots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
                body: JSON.stringify({
                    chunkIndex: 0,
                    isFinal: true,
                    data: lastState.exportData.records
                })
            });
            const snapData = await snapRes.json();
            if (!snapData.success) throw new Error(snapData.error);
            
            els.syncApiBtn.innerText = 'همگام‌سازی با موفقیت انجام شد ✓';
            els.syncApiBtn.classList.replace('bg-green-600', 'bg-blue-600');
        } catch (err) {
            alert('خطا در همگام‌سازی: ' + err.message);
            els.syncApiBtn.disabled = false;
            els.syncApiBtn.innerText = 'تلاش مجدد';
        }
    });
}
`;

if (!content.includes('syncApiBtn')) {
    // Modify HTML in popup.html to include syncApiBtn
    const htmlFile = path.join(process.cwd(), 'extension/popup.html');
    let htmlContent = fs.readFileSync(htmlFile, 'utf-8');
    htmlContent = htmlContent.replace('<button id="exportBtn"', syncBtnHtml + '\n        <button id="exportBtn"');
    fs.writeFileSync(htmlFile, htmlContent);

    content = content.replace("els.exportBtn.addEventListener('click', () => {", syncLogic + "\nels.exportBtn.addEventListener('click', () => {");
    fs.writeFileSync(file, content);
}
