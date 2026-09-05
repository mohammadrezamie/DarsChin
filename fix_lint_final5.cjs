const fs = require('fs');
const path = require('path');

// 1. SchedulePlanner.tsx
const plannerPath = path.join(process.cwd(), 'src/components/SchedulePlanner.tsx');
let plannerContent = fs.readFileSync(plannerPath, 'utf-8');
if (plannerContent.includes('import { Copy } from')) {
    plannerContent = plannerContent.replace('import { Copy } from', 'import { Copy, Check } from');
}
fs.writeFileSync(plannerPath, plannerContent, 'utf-8');

// 2. tests/academic-rules.test.ts
const rulesTestPath = path.join(process.cwd(), 'tests/academic-rules.test.ts');
let rulesTestContent = fs.readFileSync(rulesTestPath, 'utf-8');
// Clean up duplicates
rulesTestContent = rulesTestContent.replace(/studentProfile: \{ userId: 'user-1' \} as any,\s*studentProfile: \{ userId: 'user-1' \} as any,/g, "studentProfile: { userId: 'user-1' } as any,");
rulesTestContent = rulesTestContent.replace(/termId: '([^']+)',/g, "");

fs.writeFileSync(rulesTestPath, rulesTestContent, 'utf-8');

console.log('Fixed lint 5');
