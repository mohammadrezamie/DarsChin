with open('extension/popup.js', 'r') as f:
    js = f.read()

import re
js = re.sub(r"els\.resultHeader\.innerHTML = (.*);", r"els.resultHeader.innerHTML = \1; // FIXED BELOW", js)
js = js.replace(r"els.resultHeader.innerHTML = iconHtml + `<span id=\"resultTitle\" class=\"${els.resultTitle.className}\">${state.status === 'COMPLETE' ? 'جمع‌آوری کامل شد (Exhaustive)' : 'جمع‌آوری ناقص (Partial)'}</span>`; // FIXED BELOW", 
r"""els.resultHeader.textContent = '';
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = iconHtml;
    els.resultHeader.appendChild(tempDiv.firstElementChild);
    
    const titleSpan = document.createElement('span');
    titleSpan.id = 'resultTitle';
    titleSpan.className = els.resultTitle.className;
    titleSpan.textContent = state.status === 'COMPLETE' ? 'جمع‌آوری کامل شد (Exhaustive)' : 'جمع‌آوری ناقص (Partial)';
    els.resultHeader.appendChild(titleSpan);""")

with open('extension/popup.js', 'w') as f:
    f.write(js)
