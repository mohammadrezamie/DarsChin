const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'src/components/SchedulePlanner.tsx');
let content = fs.readFileSync(p, 'utf-8');

if (!content.includes('const [copiedCode, setCopiedCode] = useState<string | null>(null);')) {
    content = content.replace(
        "const [activePlannerTab, setActivePlannerTab] = useState<'priorities' | 'timetable' | 'exams'>('priorities');",
        "const [activePlannerTab, setActivePlannerTab] = useState<'priorities' | 'timetable' | 'exams'>('priorities');\n  const [copiedCode, setCopiedCode] = useState<string | null>(null);\n  const handleCopyCode = (code: string) => {\n    navigator.clipboard.writeText(code);\n    setCopiedCode(code);\n    setTimeout(() => setCopiedCode(null), 2000);\n  };"
    );
}

// Ensure Check is imported
if (!content.includes('Check,')) {
    content = content.replace("Copy,", "Copy,\n  Check,");
}

const targetHtml = `<span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              کد {pc.courseCode}
                            </span>`;
const newHtml = `<span className="text-[11px] font-mono px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                              کد {pc.courseCode}
                            </span>
                            <button
                              onClick={() => handleCopyCode(primary?.rawCourseCode || primary?.courseCode || pc.courseCode)}
                              className="px-2.5 py-1 flex items-center gap-1.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 transition-colors text-[11px] font-bold"
                              title="کپی کد ارائه جهت پیست در آموزشیار"
                            >
                              {copiedCode === (primary?.rawCourseCode || primary?.courseCode || pc.courseCode) ? (
                                <>
                                  <Check className="w-3.5 h-3.5" />
                                  کپی شد
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  کپی کد آموزشیار
                                </>
                              )}
                            </button>`;

content = content.replace(targetHtml, newHtml);
fs.writeFileSync(p, content, 'utf-8');
console.log('Added individual copy button');
