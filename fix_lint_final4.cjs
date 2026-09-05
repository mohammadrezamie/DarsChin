const fs = require('fs');
const path = require('path');

// 1. SchedulePlanner.tsx
const plannerPath = path.join(process.cwd(), 'src/components/SchedulePlanner.tsx');
let plannerContent = fs.readFileSync(plannerPath, 'utf-8');
if (!plannerContent.includes('Check,')) {
    plannerContent = plannerContent.replace('Copy,', 'Copy, Check,');
}
fs.writeFileSync(plannerPath, plannerContent, 'utf-8');

// 2. tests/academic-rules.test.ts
const rulesTestPath = path.join(process.cwd(), 'tests/academic-rules.test.ts');
let rulesTestContent = fs.readFileSync(rulesTestPath, 'utf-8');
// Replace all studentId with studentProfile
rulesTestContent = rulesTestContent.replace(/studentId: '([^']+)',?/g, "studentProfile: { userId: '$1' } as any,");
fs.writeFileSync(rulesTestPath, rulesTestContent, 'utf-8');

console.log('Fixed lint 4');
