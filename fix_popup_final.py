with open('extension/popup.js', 'r') as f:
    lines = f.readlines()

for i, line in enumerate(lines):
    if "els.resultHeader.innerHTML = iconHtml" in line:
        lines[i] = """    els.resultHeader.textContent = '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = iconHtml;
    els.resultHeader.appendChild(tempDiv.firstElementChild);
    const titleSpan = document.createElement('span');
    titleSpan.id = 'resultTitle';
    titleSpan.className = els.resultTitle.className;
    titleSpan.textContent = state.status === 'COMPLETE' ? 'جمع‌آوری کامل شد (Exhaustive)' : 'جمع‌آوری ناقص (Partial)';
    els.resultHeader.appendChild(titleSpan);
"""
    if "} catch (err) {}" in line:
        lines[i] = line.replace("} catch (err) {}", "} catch (err) { console.error('Failed to copy', err); els.copyDebugBtn.textContent = 'خطا در کپی'; setTimeout(() => els.copyDebugBtn.textContent = 'کپی گزارش', 2000); }")

with open('extension/popup.js', 'w') as f:
    f.writelines(lines)

with open('extension/popup.js', 'r') as f:
    js = f.read()

import re
# Using a specific replacement for the startBtn listener
js = js.replace("""els.startBtn.addEventListener('click', async () => {
    els.errorCard.classList.add('hidden');
    els.resultCard.classList.add('hidden');
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { type: 'START_EXTRACTION' });
});""", """els.startBtn.addEventListener('click', async () => {
    try {
        els.errorCard.classList.add('hidden');
        els.resultCard.classList.add('hidden');
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { type: 'START_EXTRACTION' });
    } catch (e) {
        showError('خطا در ارتباط با صفحه. لطفاً صفحه سیستم جامع را باز کنید.');
    }
});""")

js = js.replace("""els.stopBtn.addEventListener('click', async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    chrome.tabs.sendMessage(tab.id, { type: 'STOP_EXTRACTION' });
});""", """els.stopBtn.addEventListener('click', async () => {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        chrome.tabs.sendMessage(tab.id, { type: 'STOP_EXTRACTION' });
    } catch (e) {
        showError('خطا در توقف عملیات.');
    }
});""")

with open('extension/popup.js', 'w') as f:
    f.write(js)
