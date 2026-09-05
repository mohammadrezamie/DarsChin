const fs = require('fs');
const path = require('path');
const enginePath = path.join(process.cwd(), 'src/domain/recommendation-engine.ts');

let content = fs.readFileSync(enginePath, 'utf-8');

// Add import
if (!content.includes('extractSourceCourseIds')) {
  content = content.replace(
    "import {\n  Course,",
    "import { extractSourceCourseIds } from '../utils/academic';\nimport {\n  Course,"
  );
}

// Fix dependency graph logic
const oldDepLogic = `  const dependencyGraph = new Map<string, string[]>();
  for (const rule of academicRules) {
    if (rule.curriculumId === curriculum.id) {
      const dependents = dependencyGraph.get(rule.sourceCourseId) || [];
      if (!dependents.includes(rule.targetCourseId)) {
        dependents.push(rule.targetCourseId);
      }
      dependencyGraph.set(rule.sourceCourseId, dependents);
    }
  }`;

const newDepLogic = `  const dependencyGraph = new Map<string, string[]>();
  for (const rule of academicRules) {
    if (rule.curriculumId === curriculum.id) {
      const sourceCourseIds = extractSourceCourseIds(rule.expression);
      for (const sourceId of sourceCourseIds) {
        const dependents = dependencyGraph.get(sourceId) || [];
        if (!dependents.includes(rule.targetCourseId)) {
          dependents.push(rule.targetCourseId);
        }
        dependencyGraph.set(sourceId, dependents);
      }
    }
  }`;

content = content.replace(oldDepLogic, newDepLogic);
fs.writeFileSync(enginePath, content, 'utf-8');
console.log('Recommendation engine fixed.');
