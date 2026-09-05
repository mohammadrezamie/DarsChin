const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'src/domain/eligibility-engine.ts');
let content = fs.readFileSync(p, 'utf-8');

content = content.replace(
  "{ finalSemesterRuleEnabled: true, finalSemesterThresholdUnits: 24 } as any",
  "{ finalSemesterRuleEnabled: true, finalSemesterThresholdUnits: 24, normalMinUnits: 12, normalMaxUnits: 20, gpaBonusThreshold: 17, gpaBonusMaxUnits: 24, summerMinUnits: 1, summerMaxUnits: 8, finalSemesterMaxUnits: 24 } as any"
);

fs.writeFileSync(p, content, 'utf-8');
console.log('Fixed settings object in engine');
