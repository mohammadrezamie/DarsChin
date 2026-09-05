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
with open('extension/popup.js', 'w') as f:
    f.writelines(lines)
