const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'src/types/index.ts');
let content = fs.readFileSync(p, 'utf-8');

if (!content.includes('isExtraUnit?: boolean;')) {
  content = content.replace(
    '  active: boolean;',
    '  active: boolean;\n  isExtraUnit?: boolean; // مازاد بر واحد'
  );
  fs.writeFileSync(p, content, 'utf-8');
}
