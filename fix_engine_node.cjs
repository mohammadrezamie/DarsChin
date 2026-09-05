const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'src/domain/eligibility-engine.ts');
let content = fs.readFileSync(p, 'utf-8');
content = content.replace(
  "      ): { passed: boolean; missing: Array<{ id: string; name: string; code: string }>; reasons: string[] } => {\n        if (node.type === 'COURSE') {",
  "      ): { passed: boolean; missing: Array<{ id: string; name: string; code: string }>; reasons: string[] } => {\n        if (!node) return { passed: true, missing: [], reasons: [] };\n        if (node.type === 'COURSE') {"
);
fs.writeFileSync(p, content, 'utf-8');
