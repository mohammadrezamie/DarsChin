const fs = require('fs');
const path = require('path');

// Fix server/db/seed.ts
const seedPath = path.join(process.cwd(), 'server/db/seed.ts');
let seedContent = fs.readFileSync(seedPath, 'utf-8');
seedContent = seedContent.replace(/studentProfiles,\n\s*studentPassedCourses/g, 'studentProfiles: [],\n    studentPassedCourses: []');
fs.writeFileSync(seedPath, seedContent, 'utf-8');

// Fix src/components/AdminAcademicRules.tsx
const adminRulesPath = path.join(process.cwd(), 'src/components/AdminAcademicRules.tsx');
if (fs.existsSync(adminRulesPath)) {
  let adminRulesContent = fs.readFileSync(adminRulesPath, 'utf-8');
  adminRulesContent = adminRulesContent.replace(/RuleConditionType/g, "RelationshipType"); // Temp fix
  fs.writeFileSync(adminRulesPath, adminRulesContent, 'utf-8');
}

// Fix server/routes/curriculum.ts
const curriculumPath = path.join(process.cwd(), 'server/routes/curriculum.ts');
if (fs.existsSync(curriculumPath)) {
  let curriculumContent = fs.readFileSync(curriculumPath, 'utf-8');
  // Need to fix how it fetches prereqs
  curriculumContent = curriculumContent.replace(/r\.sourceCourseId/g, 'r.expression.courseId');
  fs.writeFileSync(curriculumPath, curriculumContent, 'utf-8');
}

// Fix src/domain/recommendation-engine.ts
const recPath = path.join(process.cwd(), 'src/domain/recommendation-engine.ts');
if (fs.existsSync(recPath)) {
  let recContent = fs.readFileSync(recPath, 'utf-8');
  // Need to fix unlocked courses logic
  recContent = recContent.replace(/r\.sourceCourseId/g, 'r.expression.courseId');
  fs.writeFileSync(recPath, recContent, 'utf-8');
}

console.log('Other errors fixed tentatively.');
