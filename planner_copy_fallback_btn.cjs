const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'src/components/SchedulePlanner.tsx');
let content = fs.readFileSync(p, 'utf-8');

const targetHtml = `<span className="font-mono text-slate-500 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">                                  گروه {fb.groupCode}                                </span>`;
const newHtml = `<span className="font-mono text-slate-500 bg-white dark:bg-slate-900 px-1.5 py-0.5 rounded border border-slate-200 dark:border-slate-700">                                  گروه {fb.groupCode}                                </span>
                                <button
                                  onClick={() => handleCopyCode(fb.rawCourseCode || fb.courseCode)}
                                  className="px-2 py-0.5 ml-2 flex items-center gap-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-emerald-100 hover:text-emerald-700 transition-colors text-[10px] font-bold"
                                  title="کپی کد جایگزین"
                                >
                                  {copiedCode === (fb.rawCourseCode || fb.courseCode) ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                                  کپی
                                </button>`;

content = content.replace(targetHtml, newHtml);
fs.writeFileSync(p, content, 'utf-8');
console.log('Added fallback copy button');
