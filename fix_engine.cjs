const fs = require('fs');
const path = require('path');
const enginePath = path.join(process.cwd(), 'src/domain/eligibility-engine.ts');

let content = fs.readFileSync(enginePath, 'utf-8');

const newRuleEvalLogic = `
      const missingPrereqs: Array<{ id: string; name: string; code: string }> = [];
      const prereqReasons: string[] = [];
      const missingCoreqs: Array<{ id: string; name: string; code: string }> = [];
      const coreqReasons: string[] = [];

      // Helper to evaluate an AcademicRuleNode
      const evaluateRuleNode = (
        node: any,
        isCorequisite: boolean,
        isContextualRetake: boolean
      ): { passed: boolean; missing: Array<{ id: string; name: string; code: string }>; reasons: string[] } => {
        if (node.type === 'COURSE') {
          const reqCourse = coursesMap.get(node.courseId);
          if (!reqCourse) return { passed: true, missing: [], reasons: [] };

          const isPassed = passedCourses.some((p) => p.courseId === reqCourse.id && p.status === 'PASSED');
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
        } else if (node.type === 'GROUP') {
          if (!node.operands || node.operands.length === 0) return { passed: true, missing: [], reasons: [] };
          
          if (node.operator === 'OR') {
            const results = node.operands.map((op: any) => evaluateRuleNode(op, isCorequisite, isContextualRetake));
            if (results.some((r: any) => r.passed)) return { passed: true, missing: [], reasons: [] };
            
            // If failed OR, combine all missing
            const allMissing = results.flatMap((r: any) => r.missing);
            return {
              passed: false,
              missing: allMissing,
              reasons: [\`حداقل یکی از شروط زیر باید برآورده شود: (\${results.map((r: any) => r.reasons.join(' و ')).join(' یا ')})\`],
            };
          } else {
            // AND
            const results = node.operands.map((op: any) => evaluateRuleNode(op, isCorequisite, isContextualRetake));
            const failedResults = results.filter((r: any) => !r.passed);
            if (failedResults.length === 0) return { passed: true, missing: [], reasons: [] };
            
            return {
              passed: false,
              missing: failedResults.flatMap((r: any) => r.missing),
              reasons: failedResults.flatMap((r: any) => r.reasons),
            };
          }
        }
        return { passed: true, missing: [], reasons: [] };
      };

      for (const rule of applicableRules) {
        const isCoreq = rule.relationshipType === 'COREQUISITE';
        const isRetake = rule.relationshipType === 'CONTEXTUAL_RETAKE_RULE';
        const res = evaluateRuleNode(rule.expression, isCoreq, isRetake);
        
        if (!res.passed) {
          if (isCoreq || (isRetake && res.reasons[0]?.includes('همین ترم'))) {
            missingCoreqs.push(...res.missing);
            coreqReasons.push(...res.reasons);
          } else {
            missingPrereqs.push(...res.missing);
            prereqReasons.push(...res.reasons);
          }
        }
      }
`;

const startIndex = content.indexOf('const prereqRules = applicableRules.filter((r) => r.relationshipType');
if (startIndex !== -1) {
  const endIndex = content.indexOf('// Track Status Decision', startIndex);
  if (endIndex !== -1) {
    content = content.substring(0, startIndex) + newRuleEvalLogic + '\n      ' + content.substring(endIndex);
    fs.writeFileSync(enginePath, content, 'utf-8');
    console.log('Engine logic updated.');
  } else {
    console.log('End index not found');
  }
} else {
  console.log('Start index not found');
}
