const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'src/domain/eligibility-engine.ts');
let content = fs.readFileSync(p, 'utf-8');

content = content.replace(
  "const isPassed = passedCourses.some((p) => p.courseId === reqCourse.id && p.status === 'PASSED');",
  "const isPassed = passedCourseIdsSet.has(reqCourse.id);"
);

// We should also check for "isFailed" to support the corequisite fallback
const targetContextual = `          if (isContextualRetake) {
            if (isPassed || isPlannedInSameTerm) return { passed: true, missing: [], reasons: [] };
            return {
              passed: false,
              missing: [{ id: reqCourse.id, name: reqCourse.name, code: reqCourse.code }],
              reasons: [\`برای درس \${course.name}، چون پیش‌نیاز (\${reqCourse.name}) مردود شده، باید در همین ترم همراه این درس اخذ شود (یا قبلاً پاس شده باشد).\`],
            };
          }`;

// Let's modify the entire block for COURSE evaluation to properly handle IAU failed prerequisite logic.
// The prompt states: "If a prerequisite course was previously FAILED, the student may be allowed to take the prerequisite course and its dependent course together in the following term, effectively treating the prerequisite as a corequisite for that term."

// We need a helper to check if a course was failed previously:
const isFailedLogic = `
          const isPassed = passedCourseIdsSet.has(reqCourse.id);
          const isPlannedInSameTerm = plannedCourseIdsSet.has(reqCourse.id);
          const wasFailed = passedCourses.some(p => p.courseId === reqCourse.id && (p.status === 'FAILED' || (p.grade !== undefined && p.grade < 10)));
`;

const courseEvalReplacement = `        if (node.type === 'COURSE') {
          const reqCourse = coursesMap.get(node.courseId);
          if (!reqCourse) return { passed: true, missing: [], reasons: [] };

          const isPassed = passedCourseIdsSet.has(reqCourse.id);
          const isPlannedInSameTerm = plannedCourseIdsSet.has(reqCourse.id);
          const wasFailed = passedCourses.some(p => p.courseId === reqCourse.id && (p.status === 'FAILED' || (p.grade !== undefined && p.grade < 10)));

          // Final Semester Rule Bypass
          const { isFinalSemester } = calculateAcademicLimits(
            studentProfile,
            allCourses,
            curriculumCourses,
            passedCourses,
            { finalSemesterRuleEnabled: true, finalSemesterThresholdUnits: 24 } as any
          );
          if (isFinalSemester) {
             return { passed: true, missing: [], reasons: [] };
          }

          if (isCorequisite) {
            // Corequisite logic
            if (isPassed || isPlannedInSameTerm) return { passed: true, missing: [], reasons: [] };
            return { passed: false, missing: [{ id: reqCourse.id, name: reqCourse.name, code: reqCourse.code }], reasons: [\`برای اخذ درس \${course.name}، درس «\${reqCourse.name}» باید در همین ترم اخذ شود یا قبلاً پاس شده باشد.\`] };
          }
          
          if (isContextualRetake || wasFailed) {
            // IAU Failed Prerequisite Exception (acts as corequisite)
            if (isPassed || isPlannedInSameTerm) return { passed: true, missing: [], reasons: [] };
            return {
              passed: false,
              missing: [{ id: reqCourse.id, name: reqCourse.name, code: reqCourse.code }],
              reasons: [\`برای درس \${course.name}، چون پیش‌نیاز (\${reqCourse.name}) قبلاً مردود شده، مجاز به اخذ همزمان می‌باشید اما در برنامه شما انتخاب نشده است.\`],
            };
          }

          // Normal Prerequisite
          if (isPassed) return { passed: true, missing: [], reasons: [] };
          return {
            passed: false,
            missing: [{ id: reqCourse.id, name: reqCourse.name, code: reqCourse.code }],
            reasons: [\`برای اخذ درس \${course.name}، درس «\${reqCourse.name}» باید قبلاً پاس شده باشد.\`],
          };
        }`;

content = content.replace(/if \(node\.type === 'COURSE'\) \{[\s\S]*?\/\/ Normal Prerequisite[\s\S]*?\}\s*\} else if/m, courseEvalReplacement + " else if");

// Also need to import calculateAcademicLimits if not imported
if (!content.includes('calculateAcademicLimits')) {
    content = "import { calculateAcademicLimits } from './academic-policy';\n" + content;
}

fs.writeFileSync(p, content, 'utf-8');
console.log('Fixed eligibility engine');
