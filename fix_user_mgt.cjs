const fs = require('fs');
const path = require('path');
const uiPath = path.join(process.cwd(), 'src/components/UserManagement.tsx');

let content = fs.readFileSync(uiPath, 'utf-8');

// Add "وضعیت تحصیلی" table header
if (content.includes('<th className="px-4 py-3">نقش فعلی</th>')) {
  content = content.replace('<th className="px-4 py-3">نقش فعلی</th>', '<th className="px-4 py-3">نقش فعلی</th>\n              <th className="px-4 py-3">وضعیت تحصیلی (Major/Entry)</th>');
}

// Add student profile cell
if (content.includes('</select>')) {
  content = content.replace(
    '</span>\n                </td>',
    '</span>\n                </td>\n                <td className="px-4 py-4 text-xs text-slate-500 max-w-xs">{u.roles?.includes("student") ? `دانشجوی ${(u as any).profile?.majorId || "-"} ورود ${(u as any).profile?.entryYearId || "-"}` : "-"}</td>'
  );
}

fs.writeFileSync(uiPath, content, 'utf-8');
console.log('UserManagement updated.');
