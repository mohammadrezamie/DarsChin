const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'server/routes/student.ts');
let content = fs.readFileSync(p, 'utf-8');

const targetStr = `const newEntry: StudentPassedCourse = {
    id: \`spc-\${Date.now()}\`,
    userId,
    courseId,
    grade: grade !== undefined && grade !== '' ? Number(grade) : undefined,
    termId: termId || undefined,
    passedAt: new Date().toISOString(),
  };`;

const newStr = `const newEntry: StudentPassedCourse = {
    id: \`spc-\${Date.now()}\`,
    userId,
    courseId,
    grade: grade !== undefined && grade !== '' ? Number(grade) : undefined,
    status: (grade !== undefined && grade !== '' && Number(grade) < 10) ? 'FAILED' : 'PASSED',
    termId: termId || undefined,
    passedAt: new Date().toISOString(),
  };`;

content = content.replace(targetStr, newStr);

// Let's also fix batch route if it doesn't set status
content = content.replace(
  `id: \`spc-\${Date.now()}-\${Math.random().toString(36).substr(2, 5)}\`,
          userId,
          courseId: cId,
          passedAt: new Date().toISOString(),`,
  `id: \`spc-\${Date.now()}-\${Math.random().toString(36).substr(2, 5)}\`,
          userId,
          courseId: cId,
          status: 'PASSED',
          passedAt: new Date().toISOString(),`
);

fs.writeFileSync(p, content, 'utf-8');
console.log('Fixed student API');
