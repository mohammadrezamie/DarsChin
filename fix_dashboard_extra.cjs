const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'src/components/StudentDashboard.tsx');
let content = fs.readFileSync(p, 'utf-8');

content = content.replace(
  "const isExtra = newEval.courseName.includes('وصایا') || newEval.courseName.includes('انس');",
  "const isExtra = newEval.isExtraUnit;"
);

content = content.replace(
  "if (item.courseName.includes('وصایا') || item.courseName.includes('انس')) return sum;",
  "if (item.isExtraUnit) return sum;"
);

// Check if we need to display the student stats in the dashboard correctly.
const targetPanelStr = `                    <div className="mt-2 text-xs text-slate-500">
                      رشته {contextData?.major?.name || 'نامشخص'} • {contextData?.campus?.name || 'واحد نامشخص'}
                    </div>`;

const newPanelStr = `                    <div className="mt-2 text-[11px] text-slate-500">
                      رشته {contextData?.major?.name || 'نامشخص'} • {contextData?.campus?.name || 'واحد نامشخص'}
                    </div>
                    {academicLimits && (
                      <div className="mt-4 pt-4 border-t border-slate-200/50 flex flex-wrap gap-4 text-xs">
                        <div className="bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200">
                          <span className="text-slate-500 ml-1">معدل ترم قبل:</span>
                          <span className="font-bold">{profile?.previousTermGpa ?? '-'}</span>
                          {academicLimits.isGradeA && <span className="mr-1 text-[10px] bg-amber-100 text-amber-700 px-1 py-0.5 rounded">معدل الف</span>}
                        </div>
                        <div className="bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200">
                          <span className="text-slate-500 ml-1">وضعیت ترم:</span>
                          <span className="font-bold">{academicLimits.isFinalSemester ? 'ترم آخر' : 'عادی'}</span>
                        </div>
                        <div className="bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200">
                          <span className="text-slate-500 ml-1">مجاز به اخذ:</span>
                          <span className="font-bold text-blue-600">{academicLimits.effectiveMinUnits} تا {academicLimits.effectiveMaxUnits} واحد</span>
                        </div>
                        <div className="bg-slate-50 px-2 py-1.5 rounded-lg border border-slate-200">
                          <span className="text-slate-500 ml-1">واحدهای باقیمانده:</span>
                          <span className="font-bold">{academicLimits.remainingUnits} واحد</span>
                        </div>
                      </div>
                    )}`;

content = content.replace(targetPanelStr, newPanelStr);
fs.writeFileSync(p, content, 'utf-8');
console.log('Fixed dashboard extra units and added academic limits panel');
