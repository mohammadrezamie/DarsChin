const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'tests/engine.test.ts');
let content = fs.readFileSync(p, 'utf-8');

content = `import { describe, it, expect } from 'vitest';
` + content.replace('async function runTests() {', 'describe("Engine Legacy Test", () => { it("should run successfully", async () => {').replace('runTests().catch((err) => {\n  console.error(err);\n  process.exit(1);\n});', '}); });');

fs.writeFileSync(p, content, 'utf-8');
