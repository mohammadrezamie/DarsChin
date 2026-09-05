const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'tests/academic-rules.test.ts');
let content = fs.readFileSync(p, 'utf-8');
content = content.replace(/tracks: \[\],/g, "tracks: [{id: 't1', majorId: 'm1', name: 'General Track', code: 'T1', active: true}] as any,");
content = content.replace(/studentProfile: \{\} as any/g, "studentProfile: { majorId: 'm1' } as any");
fs.writeFileSync(p, content, 'utf-8');
