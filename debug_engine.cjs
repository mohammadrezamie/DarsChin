const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'src/domain/eligibility-engine.ts');
let content = fs.readFileSync(p, 'utf-8');

content = content.replace(
  "const { isFinalSemester } = calculateAcademicLimits(",
  "const { isFinalSemester } = calculateAcademicLimits("
);
content = content.replace(
  "// Normal Prerequisite",
  "console.log('Eval:', {courseId: reqCourse.id, isPassed, isFinalSemester, wasFailed, isContextualRetake, isCorequisite}); // Normal Prerequisite"
);

fs.writeFileSync(p, content, 'utf-8');
