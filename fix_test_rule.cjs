const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'tests/academic-iaurules.test.ts');
let content = fs.readFileSync(p, 'utf-8');

content = content.replace(
  "id: 'r1', targetCourseId: 'math2', relationshipType: 'PREREQUISITE',",
  "id: 'r1', curriculumId: 'curr1', targetCourseId: 'math2', relationshipType: 'PREREQUISITE',"
);

fs.writeFileSync(p, content, 'utf-8');
console.log('Fixed test rule');
