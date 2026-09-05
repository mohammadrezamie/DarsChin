const fs = require('fs');
const path = require('path');

// 1. server/routes/academic.ts
const academicPath = path.join(process.cwd(), 'server/routes/academic.ts');
let academicContent = fs.readFileSync(academicPath, 'utf-8');
academicContent = academicContent.replace(/\s*isExtraUnit: !!isExtraUnit,\n/g, '\n');
fs.writeFileSync(academicPath, academicContent, 'utf-8');

// 2. AdminAcademicRules.tsx
const rulesPath = path.join(process.cwd(), 'src/components/AdminAcademicRules.tsx');
let rulesContent = fs.readFileSync(rulesPath, 'utf-8');
rulesContent = rulesContent.replace(
  /await apiRequest\(\`\/api\/curriculum\/rules\/\$\{id\}\`, 'DELETE'\);/g,
  "await apiRequest(`/api/curriculum/rules/${id}`, { method: 'DELETE' });"
);
rulesContent = rulesContent.replace(
  /await apiRequest\('\/api\/curriculum\/rules', 'POST', formData\);/g,
  "await apiRequest('/api/curriculum/rules', { method: 'POST', body: JSON.stringify(formData) });"
);
fs.writeFileSync(rulesPath, rulesContent, 'utf-8');

// 3. SchedulePlanner.tsx
const plannerPath = path.join(process.cwd(), 'src/components/SchedulePlanner.tsx');
let plannerContent = fs.readFileSync(plannerPath, 'utf-8');
if (!plannerContent.includes('Check,')) {
    plannerContent = plannerContent.replace('Copy,', 'Copy, Check,');
}
fs.writeFileSync(plannerPath, plannerContent, 'utf-8');

// 4. tests/academic-iaurules.test.ts
const iauTestPath = path.join(process.cwd(), 'tests/academic-iaurules.test.ts');
let iauTestContent = fs.readFileSync(iauTestPath, 'utf-8');
iauTestContent = iauTestContent.replace("universityId: 'u1'", "");
iauTestContent = iauTestContent.replace("isActive: true, ", "");
fs.writeFileSync(iauTestPath, iauTestContent, 'utf-8');

// 5. tests/academic-rules.test.ts
const rulesTestPath = path.join(process.cwd(), 'tests/academic-rules.test.ts');
let rulesTestContent = fs.readFileSync(rulesTestPath, 'utf-8');
rulesTestContent = rulesTestContent.replace(/studentId: 'user-1',/g, "studentProfile: { userId: 'user-1' } as any,");
fs.writeFileSync(rulesTestPath, rulesTestContent, 'utf-8');

console.log('Fixed lint real');
