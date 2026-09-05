const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'src/domain/eligibility-engine.ts');
let content = fs.readFileSync(p, 'utf-8');

const targetBlock = `        if (node.type === 'COURSE') {
          const reqCourse = coursesMap.get(node.courseId);
          if (!reqCourse) return { passed: true, missing: [], reasons: [] };

          const isPassed = passedCourseIdsSet.has(reqCourse.id);
          const isPlannedInSameTerm = plannedCourseIdsSet.has(reqCourse.id);

          if (isContextualRetake) {
            if (isPassed) return { passed: true, missing: [], reasons: [] };
            const failedOrAbsent = passedCourses.some(
              (p) => p.courseId === reqCourse.id && (p.status === 'FAILED' || p.status === 'ABSENT')
            );
            if (failedOrAbsent) {
              if (isPlannedInSameTerm) return { passed: true, missing: [], reasons: [] };
              return {
                passed: false,
                missing: [{ id: reqCourse.id, name: reqCourse.name, code: reqCourse.code }],
                reasons: [\`«\${reqCourse.name}» در سابقه شما مردود/غیبت ثبت شده است و باید در همین ترم اخذ شود.\`],
              };
            } else {
              return {
                passed: false,
                missing: [{ id: reqCourse.id, name: reqCourse.name, code: reqCourse.code }],
                reasons: [\`برای اخذ درس \${course.name}، درس «\${reqCourse.name}» باید قبلاً پاس شده باشد.\`],
              };
            }
          }

          if (isCorequisite) {
            if (isPassed || isPlannedInSameTerm) return { passed: true, missing: [], reasons: [] };
            return {
              passed: false,
              missing: [{ id: reqCourse.id, name: reqCourse.name, code: reqCourse.code }],
              reasons: [\`درس «\${reqCourse.name}» باید در همین ترم همراه این درس اخذ شود (یا قبلاً پاس شده باشد).\`],
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

const replacement = `        if (node.type === 'COURSE') {
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

if (content.includes(targetBlock)) {
    content = content.replace(targetBlock, replacement);
    fs.writeFileSync(p, content, 'utf-8');
    console.log('Replaced node evaluation successfully.');
} else {
    console.log('Could not find target block to replace.');
}
