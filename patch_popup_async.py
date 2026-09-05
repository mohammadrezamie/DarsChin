with open('extension/popup.js', 'r') as f:
    js = f.read()

import re
js = re.sub(r"(els\.startBtn\.addEventListener\('click', async \(\) => {)(.*?)(}\);)", 
    r"\1\n    try {\2} catch (e) { console.error('StartBtn Error:', e); showError('خطا در ارتباط با صفحه. لطفاً صفحه سیستم جامع را ریفرش کنید.'); }\n\3", 
    js, flags=re.DOTALL)

js = re.sub(r"(els\.stopBtn\.addEventListener\('click', async \(\) => {)(.*?)(}\);)", 
    r"\1\n    try {\2} catch (e) { console.error('StopBtn Error:', e); showError('خطا در ارتباط با صفحه.'); }\n\3", 
    js, flags=re.DOTALL)

with open('extension/popup.js', 'w') as f:
    f.write(js)
