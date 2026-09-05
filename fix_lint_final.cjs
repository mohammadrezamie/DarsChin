const fs = require('fs');
const path = require('path');

// Fix academic.ts
const academicPath = path.join(process.cwd(), 'server/routes/academic.ts');
let academicContent = fs.readFileSync(academicPath, 'utf-8');
academicContent = academicContent.replace(
  "const { code, name, units, practicalUnits = 0, category, description, active = true } = req.body;",
  "const { code, name, units, practicalUnits = 0, category, description, active = true, isExtraUnit } = req.body;"
);
fs.writeFileSync(academicPath, academicContent, 'utf-8');

// Fix AdminAcademicRules.tsx
const rulesPath = path.join(process.cwd(), 'src/components/AdminAcademicRules.tsx');
let rulesContent = fs.readFileSync(rulesPath, 'utf-8');
rulesContent = rulesContent.replace(
  /await apiRequest\(\`\/api\/academic\/rules\/\$\{id\}\`, 'DELETE'\);/g,
  "await apiRequest(`/api/academic/rules/${id}`, { method: 'DELETE' });"
);
rulesContent = rulesContent.replace(
  /await apiRequest\('\/api\/academic\/rules', 'POST', \{ body: JSON\.stringify\(rule\) \}\);/g,
  "await apiRequest('/api/academic/rules', { method: 'POST', body: JSON.stringify(rule) });"
);
rulesContent = rulesContent.replace(
  /await apiRequest\(\`\/api\/academic\/rules\/\$\{rule\.id\}\`, 'PUT', \{ body: JSON\.stringify\(rule\) \}\);/g,
  "await apiRequest(`/api/academic/rules/${rule.id}`, { method: 'PUT', body: JSON.stringify(rule) });"
);
fs.writeFileSync(rulesPath, rulesContent, 'utf-8');

// Fix SchedulePlanner.tsx
const plannerPath = path.join(process.cwd(), 'src/components/SchedulePlanner.tsx');
let plannerContent = fs.readFileSync(plannerPath, 'utf-8');
if (!plannerContent.includes('Check,')) {
    plannerContent = plannerContent.replace('import {\n', 'import {\n  Check,\n');
}
fs.writeFileSync(plannerPath, plannerContent, 'utf-8');

// Fix eligibility-engine.ts
const enginePath = path.join(process.cwd(), 'src/domain/eligibility-engine.ts');
let engineContent = fs.readFileSync(enginePath, 'utf-8');
engineContent = engineContent.replace(
  "isExtraUnit: course.isExtraUnit,",
  ""
);
fs.writeFileSync(enginePath, engineContent, 'utf-8');

// Fix academic-iaurules.test.ts
const testPath = path.join(process.cwd(), 'tests/academic-iaurules.test.ts');
let testContent = fs.readFileSync(testPath, 'utf-8');
testContent = testContent.replace(" isActive: true,", "");
fs.writeFileSync(testPath, testContent, 'utf-8');

console.log('Fixed lint 3');
