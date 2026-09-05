import { evaluateStudentEligibility } from '../src/domain/eligibility-engine';
import { db } from '../server/db/database';
import assert from 'assert';

async function runTests() {
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
  const coreqRules = db.academicRules.filter((cr) => cr.curriculumId === curriculum.id);
  const passedCourses = db.studentPassedCourses.filter((pc) => pc.userId === profile.userId);
  const allCourses = db.courses;
  const currentOfferings = db.courseOfferings;

  const result = evaluateStudentEligibility({
    studentProfile: profile,
    curriculum,
    curriculumCourses,
    allCourses,
    tracks: db.tracks,
    academicRules: prereqRules,
    
    passedCourses,
    currentOfferings,
  });

  console.log(`Total offerings evaluated: ${result.totalOfferingsEvaluated}`);
  console.log(`Eligible: ${result.eligibleCount}`);
  console.log(`Blocked: ${result.blockedCount}`);
  console.log(`Already Passed: ${result.alreadyPassedCount}`);

  assert(result.totalOfferingsEvaluated > 0, 'No offerings were evaluated');

  console.log('✅ Eligibility Engine test passed successfully!');
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
