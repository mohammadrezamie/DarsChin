const fs = require('fs');
const path = require('path');

// 1. SchedulePlanner.tsx
const plannerPath = path.join(process.cwd(), 'src/components/SchedulePlanner.tsx');
let plannerContent = fs.readFileSync(plannerPath, 'utf-8');
if (!plannerContent.includes('Check,')) {
    plannerContent = plannerContent.replace(/import\s*\{([^}]*)\}\s*from\s*'lucide-react';/, function(match, p1) {
        if (!p1.includes('Check')) {
            return `import {${p1}, Check} from 'lucide-react';`;
        }
        return match;
    });
}
fs.writeFileSync(plannerPath, plannerContent, 'utf-8');

// 2. tests/academic-rules.test.ts
const rulesTestPath = path.join(process.cwd(), 'tests/academic-rules.test.ts');
let rulesTestContent = fs.readFileSync(rulesTestPath, 'utf-8');

rulesTestContent = rulesTestContent.replace(/studentAcademicLimits: \{ policySettings: \{ normalMaxUnits: 20 \} \} as any,/g, "");

fs.writeFileSync(rulesTestPath, rulesTestContent, 'utf-8');

console.log('Fixed lint 7');
