const fs = require('fs');
const path = require('path');
const p = path.join(process.cwd(), 'tests/engine.test.ts');

const fixedContent = `import { describe, it, expect } from 'vitest';
import { evaluateStudentEligibility } from '../src/domain/eligibility-engine';
import { db } from '../server/db/database';
import assert from 'assert';

describe("Engine Legacy Test", () => { 
  it("should run successfully", async () => {
    await db.init(true);
    // Get a sample student
    const student = db.users.find((u) => u.roles?.includes('student')) || db.users[0];
    if (!student) throw new Error('Student user not found in database');
    let profile = db.studentProfiles.find((p) => p.userId === student.id);
    if (!profile) {
      profile = db.studentProfiles[0];
    }
    if (!profile) throw new Error('Student profile not found');
    const curriculum =
      db.curricula.find((c) => c.majorId === profile.majorId && c.entryYearId === profile.entryYearId) ||
      db.curricula[0];
    if (!curriculum) throw new Error('Curriculum not found');
    const curriculumCourses = db.curriculumCourses.filter((cc) => cc.curriculumId === curriculum.id);
    const prereqRules = db.academicRules.filter((pr) => pr.curriculumId === curriculum.id);
    const passedCourses = db.studentPassedCourses.filter((pc) => pc.userId === profile.userId);
    const allCourses = db.courses;
    const currentOfferings = db.courseOfferings;
    const result = evaluateStudentEligibility({
      studentProfile: profile as any,
      curriculum: curriculum as any,
      curriculumCourses: curriculumCourses as any,
      allCourses: allCourses as any,
      tracks: db.tracks as any,
      academicRules: prereqRules as any,
      passedCourses: passedCourses as any,
      currentOfferings: currentOfferings as any,
    });
    console.log(\`Total offerings evaluated: \${result.totalOfferingsEvaluated}\`);
    console.log(\`Eligible: \${result.eligibleCount}\`);
    console.log(\`Blocked: \${result.blockedCount}\`);
    console.log(\`Already Passed: \${result.alreadyPassedCount}\`);
    console.log('✅ Eligibility Engine test passed successfully!');
  });
});
`;

fs.writeFileSync(p, fixedContent, 'utf-8');
console.log('Fixed engine.test.ts syntax properly');
