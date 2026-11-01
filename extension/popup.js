const els = {
    startBtn: document.getElementById('startBtn'),
    stopBtn: document.getElementById('stopBtn'),
    exportBtn: document.getElementById('exportBtn'),
    progressCard: document.getElementById('progressCard'),
    resultCard: document.getElementById('resultCard'),
    errorCard: document.getElementById('errorCard'),
    
    connDot: document.getElementById('connDot'),
    connStatus: document.getElementById('connStatus'),
    connCard: document.getElementById('connCard'),
    
    statusText: document.getElementById('statusText'),
    currentPhase: document.getElementById('currentPhase'),
    elapsedTime: document.getElementById('elapsedTime'),
    requestsCount: document.getElementById('requestsCount'),
    pagesCount: document.getElementById('pagesCount'),
    rawRecordsCount: document.getElementById('rawRecordsCount'),
    uniqueClassesCount: document.getElementById('uniqueClassesCount'),
    
    resultHeader: document.getElementById('resultHeader'),
    resultTitle: document.getElementById('resultTitle'),
    resultMessage: document.getElementById('resultMessage'),
    resCourses: document.getElementById('resCourses'),
    resClasses: document.getElementById('resClasses'),
    errorMessage: document.getElementById('errorMessage'),
    
    debugToggleBtn: document.getElementById('debugToggleBtn'),
    debugContent: document.getElementById('debugContent'),
    debugChevron: document.getElementById('debugChevron'),
    saveDebugBtn: document.getElementById('saveDebugBtn'),
    copyDebugBtn: document.getElementById('copyDebugBtn'),
    
    dbgCoverage: document.getElementById('dbgCoverage'),
    dbgAnomalies: document.getElementById('dbgAnomalies'),
    dbgBatches: document.getElementById('dbgBatches'),
    dbgEmpty: document.getElementById('dbgEmpty'),
    dbgUnresolved: document.getElementById('dbgUnresolved'),
    dbgDups: document.getElementById('dbgDups')
};

let lastState = null;
const EXTENSION_VERSION = "3.3.6";

document.addEventListener('DOMContentLoaded', () => {
    checkConnection();

    const syncTokenInput = document.getElementById('syncTokenInput');
    chrome.storage.local.get(['darschyn_sync_token'], (res) => {
        if (res.darschyn_sync_token) syncTokenInput.value = res.darschyn_sync_token;
    });
    syncTokenInput.addEventListener('input', (e) => {
        chrome.storage.local.set({ darschyn_sync_token: e.target.value });
    });

});

async function checkConnection() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.url.includes('iau.ir')) {
            setConnStatus('red', 'خارج از سایت آموزشیار');
            els.startBtn.disabled = true;
            return;
        }
        
        const res = await new Promise((resolve) => {
            chrome.tabs.sendMessage(tab.id, { type: 'PING' }, (response) => {
                resolve(response);
                if (chrome.runtime.lastError) {}
            });
        });

        if (res && res.type === 'PONG') {
            setConnStatus('emerald', 'آماده استخراج');
            els.startBtn.disabled = false;
            if (res.state && (res.state.status === 'PROCESSING' || res.state.status === 'COMPLETE' || res.state.status === 'PARTIAL' || res.state.status === 'FAILED')) {
                updateUI(res.state);
            }
        } else {
            setConnStatus('yellow', 'اسکریپت یافت نشد');
            els.startBtn.disabled = true;
            showError("لطفا صفحه جستجوی آموزشیار را یکبار Refresh کنید تا اسکریپت نسخه " + EXTENSION_VERSION + " فعال شود.");
        }
    } catch (err) {
        setConnStatus('red', 'خطا در ارتباط');
        els.startBtn.disabled = true;
    }
}

function setConnStatus(color, text) {
    els.connDot.className = `w-2 h-2 rounded-full bg-${color}-500 ${color === 'emerald' ? '' : 'animate-pulse'}`;
    els.connStatus.textContent = text;
    els.connCard.className = `flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-${color}-500/30 bg-${color}-500/10`;
}

function formatNumber(num) {
    return new Intl.NumberFormat('fa-IR').format(num || 0);
}

function msToTime(duration) {
    if (!duration) return "00:00";
    let seconds = Math.floor((duration / 1000) % 60);
    let minutes = Math.floor((duration / (1000 * 60)) % 60);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function updateUI(state) {
    if (!state) return;
    lastState = state;
    
    // Status Switcher
    if (state.status === 'PROCESSING') {
        els.startBtn.classList.add('hidden');
        els.stopBtn.classList.remove('hidden');
        els.progressCard.classList.remove('hidden');
        els.progressCard.classList.add('flex');
        els.resultCard.classList.add('hidden');
        els.errorCard.classList.add('hidden');
    } else {
        els.startBtn.classList.remove('hidden');
        els.stopBtn.classList.add('hidden');
        els.startBtn.textContent = 'شروع مجدد جمع‌آوری';
    }

    if (state.status === 'COMPLETE' || state.status === 'PARTIAL' || state.status === 'FAILED' || state.status === 'CANCELLED') {
        els.progressCard.classList.add('hidden');
        if (state.status === 'FAILED' || state.status === 'CANCELLED') {
            showError(state.error || (state.status === 'CANCELLED' ? "توسط کاربر متوقف شد." : "خطای ناشناخته."));
        } else {
            showResult(state);
        }
    }

    // Live Progress Update
    if (state.stats) {
        let statusText = 'در حال استخراج...';
        if (state.phase === 'ROOT_SEARCH') statusText = 'جستجوی اولیه...';
        else if (state.phase === 'RECURSIVE_BATCHING') statusText = 'شکستن بازه جستجو...';
        else if (state.phase === 'ROOT_EXTRACTION') statusText = 'استخراج مستقیم...';

        els.statusText.textContent = statusText;
        els.currentPhase.textContent = state.phase;
        els.elapsedTime.textContent = msToTime(state.durationMs || 0);
        
        els.requestsCount.textContent = formatNumber(state.stats.requestsSent);
        els.pagesCount.textContent = formatNumber(state.stats.pagesProcessed);
        els.rawRecordsCount.textContent = formatNumber(state.stats.rawRows);
        els.uniqueClassesCount.textContent = formatNumber(state.stats.uniqueClasses);

        // Debug info update
        els.dbgCoverage.textContent = state.status;
        els.dbgAnomalies.textContent = state.anomalies ? state.anomalies.length : 0;
        els.dbgBatches.textContent = state.stats.batchesTotal;
        els.dbgEmpty.textContent = state.stats.batchesCompletedEmpty;
        els.dbgUnresolved.textContent = state.stats.batchesUnresolved;
        els.dbgDups.textContent = state.stats.duplicatesRemoved;
    }
}

function showResult(state) {
    els.resultCard.classList.remove('hidden');
    els.resultCard.classList.add('flex');
    els.resultCard.className = `flex flex-col gap-3 card ${state.status === 'COMPLETE' ? 'bg-emerald-900/20 border-emerald-500/30' : 'bg-amber-900/20 border-amber-500/30'}`;
    els.resultHeader.className = `flex items-center gap-2 border-b pb-2 ${state.status === 'COMPLETE' ? 'border-emerald-500/20' : 'border-amber-500/20'}`;
    
    els.resultTitle.className = `text-sm font-bold ${state.status === 'COMPLETE' ? 'text-emerald-400' : 'text-amber-400'}`;
    els.resultMessage.className = `text-xs leading-relaxed ${state.status === 'COMPLETE' ? 'text-emerald-100/80' : 'text-amber-100/80'}`;

    let iconHtml = state.status === 'COMPLETE' 
        ? `<div class="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">✓</div>`
        : `<div class="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold text-sm">⚠</div>`;
    
    els.resultHeader.textContent = '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = iconHtml;
    els.resultHeader.appendChild(tempDiv.firstElementChild);
    const titleSpan = document.createElement('span');
    titleSpan.id = 'resultTitle';
    titleSpan.className = els.resultTitle.className;
    titleSpan.textContent = state.status === 'COMPLETE' ? 'جمع‌آوری کامل شد (Exhaustive)' : 'جمع‌آوری ناقص (Partial)';
    els.resultHeader.appendChild(titleSpan);
    
    let unresolvedStr = '';
    if (state.status === 'PARTIAL') {
        let issues = [];
        if (state.stats.batchesUnresolved > 0) issues.push(`${state.stats.batchesUnresolved} زیربخش نامشخص`);
        if (state.stats.batchesPaginationUnresolved > 0) issues.push(`${state.stats.batchesPaginationUnresolved} خطای صفحه‌بندی`);
        if (state.stats.batchesLimitExceeded > 0) issues.push(`${state.stats.batchesLimitExceeded} زیربخشِ سرریز شده`);
        unresolvedStr = ` برخی داده‌ها ممکن است استخراج نشده باشند. (` + issues.join(' ، ') + `)`;
    }

    els.resultMessage.textContent = `عملیات در ${msToTime(state.durationMs)} پایان یافت.${unresolvedStr}`;
    els.resCourses.textContent = formatNumber(state.stats.uniqueCourses);
    els.resClasses.textContent = formatNumber(state.stats.uniqueClasses);
}

function showError(msg) {
    els.errorCard.classList.remove('hidden');
    els.errorCard.classList.add('flex');
    els.errorMessage.textContent = msg;
}

els.startBtn.addEventListener('click', async () => {
    try {
        els.errorCard.classList.add('hidden');
        els.resultCard.classList.add('hidden');
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { type: 'START_EXTRACTION' });
    } catch (e) {
        showError('خطا در ارتباط با صفحه. لطفاً صفحه سیستم جامع را باز کنید.');
    }
});

els.stopBtn.addEventListener('click', async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { type: 'STOP_EXTRACTION' });
    } catch (e) {
        showError('خطا در توقف عملیات.');
    }
});

chrome.runtime.onMessage.addListener((request) => {
    if (request.type === 'STATE_UPDATE') {
        updateUI(request.state);
    }
});

// Debug Toggle
els.debugToggleBtn.addEventListener('click', () => {
    const isHidden = els.debugContent.classList.contains('hidden');
    if (isHidden) {
        els.debugContent.classList.remove('hidden');
        els.debugContent.classList.add('flex');
        els.debugChevron.style.transform = 'rotate(180deg)';
    } else {
        els.debugContent.classList.add('hidden');
        els.debugContent.classList.remove('flex');
        els.debugChevron.style.transform = 'rotate(0deg)';
    }
});

function getCleanDebugReport() {
    if (!lastState) return null;
    let s = lastState;
    return {
        run: {
            status: s.status,
            requests: s.stats.requestsSent,
            pages: s.stats.pagesProcessed,
            rawRows: s.stats.rawRows,
            uniqueClasses: s.stats.uniqueClasses,
            uniqueCourses: s.stats.uniqueCourses,
            duplicatesRemoved: s.stats.duplicatesRemoved,
            durationMs: s.durationMs
        },
        batches: {
            total: s.stats.batchesTotal,
            withRows: s.stats.batchesCompletedWithRows,
            empty: s.stats.batchesCompletedEmpty,
            failed: s.stats.batchesFailed,
            limitExceeded: s.stats.batchesLimitExceeded,
            unresolved: s.stats.batchesUnresolved
        },
        identity: s.debug?.identity || {},
        pagination: s.debug?.pagination || {},
        classification: s.debug?.classification || {},
        tableDetection: s.debug?.tableDetection || {},
        parser: s.debug?.parser || {},
        anomalies: s.anomalies || []
    };
}

els.saveDebugBtn.addEventListener('click', () => {
    const report = getCleanDebugReport();
    if (!report) return;
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `darschyn_diagnostics_v${EXTENSION_VERSION}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
});

els.copyDebugBtn.addEventListener('click', async () => {
    const report = getCleanDebugReport();
    if (!report) return;
    try {
        await navigator.clipboard.writeText(JSON.stringify(report, null, 2));
        const originalText = els.copyDebugBtn.textContent;
        els.copyDebugBtn.textContent = 'کپی شد!';
        setTimeout(() => els.copyDebugBtn.textContent = originalText, 2000);
    } catch (err) { console.error('Failed to copy', err); els.copyDebugBtn.textContent = 'خطا در کپی'; setTimeout(() => els.copyDebugBtn.textContent = 'کپی گزارش', 2000); }
});


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
            
            // Upload success is a receipt, never a verified course publication.
            els.syncApiBtn.innerText = snapData.data?.jobStatus === 'AWAITING_REVIEW'
                ? 'ارسال شد؛ در انتظار بررسی مدیر'
                : 'فایل دریافت شد؛ وضعیت را در پنل بررسی کنید';
            els.syncApiBtn.classList.replace('bg-green-600', 'bg-blue-600');
        } catch (err) {
            alert('خطا در همگام‌سازی: ' + err.message);
            els.syncApiBtn.disabled = false;
            els.syncApiBtn.innerText = 'تلاش مجدد';
        }
    });
}

els.exportBtn.addEventListener('click', () => {
    if (!lastState || !lastState.exportData) return;
    const blob = new Blob([JSON.stringify(lastState.exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `darschyn_dataset_${lastState.term}_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
});
