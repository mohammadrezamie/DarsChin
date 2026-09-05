const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'tests/academic-iaurules.test.ts');
let content = fs.readFileSync(p, 'utf-8');

content = content.replace(
  "expect(res.results[0].overallStatus).toBe('BLOCKED_PREREQUISITE');",
  "console.log(JSON.stringify(res.results[0], null, 2));\n    expect(res.results[0].overallStatus).toBe('BLOCKED_PREREQUISITE');"
);

fs.writeFileSync(p, content, 'utf-8');
