// ============================================================================
// DARSCHYN (درس‌چین) - Student Academic Profile & Passed Courses Routes
// ============================================================================

import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db/database';
import { authenticate, AuthenticatedRequest } from '../middleware/auth';
import { StudentAcademicProfile, StudentPassedCourse } from '../../src/types';
import { evaluateStudentEligibility } from '../../src/domain/eligibility-engine';
import { evaluateScheduleQuality, preservesSelectedCourses } from '../../src/domain/schedule-quality';
import { plannedUnitCount } from '../../src/domain/plan-unit-limits';
import { validatePlanPriorities } from '../../src/domain/plan-priority-integrity';
import { validate } from '../middleware/validate';
import { updateProfileSchema, addPassedCourseSchema, batchPassedCoursesSchema, updatePlanSchema, planSelectSchema } from '../schemas/student';

export const studentRouter = Router();

// Academic decisions must never borrow the first chart from another campus
// or cohort. Prefer one exact active chart, consistent with GET /profile.
const findStudentCurriculum = (profile: StudentAcademicProfile) =>
  db.curricula.find(c =>
    c.status === 'active' &&
    c.universityId === profile.universityId &&
    c.campusId === profile.campusId &&
    c.degreeLevelId === profile.degreeLevelId &&
    c.majorId === profile.majorId &&
    c.entryYearId === profile.entryYearId
  ) || null;

// Get student academic profile
studentRouter.get('/profile', authenticate, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  let profile = db.studentProfiles.find((p) => p.userId === userId);

  if (!profile) {
    // A starter profile must be internally consistent. The first university,
    // campus, degree and major records are not guaranteed to belong together.
    const defaultCampus = db.campuses.find(c=>c.active!==false &&
      db.universities.some(u=>u.id===c.universityId && u.active!==false));
    const defaultUniv = db.universities.find(u=>u.id===defaultCampus?.universityId);
    const defaultMaj = db.majors.find(m=>m.active!==false &&
      db.degreeLevels.some(d=>d.id===m.degreeLevelId && d.active!==false));
    const defaultDeg = db.degreeLevels.find(d=>d.id===defaultMaj?.degreeLevelId);
    const defaultYear = db.entryYears.find(y=>y.year===1403 && y.active!==false) ||
      db.entryYears.find(y=>y.active!==false);
    const defaultTerm = db.academicTerms.find(t=>t.isCurrent && t.active!==false) ||
      db.academicTerms.find(t=>t.active!==false);

    profile = {
      userId,
      universityId: defaultUniv?.id || '',
      campusId: defaultCampus?.id || '',
      degreeLevelId: defaultDeg?.id || '',
      majorId: defaultMaj?.id || '',
      entryYearId: defaultYear?.id || '',
      isTrackSelected: false,
      selectedTrackId: null,
      desiredTrackIds: db.tracks.filter(t=>t.majorId===defaultMaj?.id && t.active!==false).map(t=>t.id),
      currentTermId: defaultTerm?.id || '',
      updatedAt: new Date().toISOString(),
    };
    db.studentProfiles.push(profile);
    db.save();
  }

  // Never fall back to the first unrelated university/entry-year chart.
  // Academic recommendations and demand must share the student's exact scope.
  const matchingCurriculum = findStudentCurriculum(profile!);

  res.json({
    success: true,
    data: {
      profile,
      curriculum: matchingCurriculum,
    },
  });
});

// Update student academic profile. Preserve private and administrator-managed
// fields; PUT from a partial student form is NOT a replacement for the whole record.
studentRouter.put('/profile', authenticate, validate(updateProfileSchema), (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const patch = req.body as Partial<StudentAcademicProfile>;
  const index = db.studentProfiles.findIndex(p=>p.userId===userId);
  const existing=index>=0?db.studentProfiles[index]:null;

  const universityId=patch.universityId ?? existing?.universityId ?? db.universities.find(u=>u.active!==false)?.id ?? '';
  const campusId=patch.campusId ?? existing?.campusId ?? db.campuses.find(c=>c.universityId===universityId && c.active!==false)?.id ?? '';
  const degreeLevelId=patch.degreeLevelId ?? existing?.degreeLevelId ?? db.degreeLevels.find(d=>d.active!==false)?.id ?? '';
  const majorId=patch.majorId ?? existing?.majorId ?? db.majors.find(m=>m.degreeLevelId===degreeLevelId && m.active!==false)?.id ?? '';
  const entryYearId=patch.entryYearId ?? existing?.entryYearId ?? db.entryYears.find(y=>y.active!==false)?.id ?? '';
  const currentTermId=patch.currentTermId ?? existing?.currentTermId ??
    db.academicTerms.find(t=>t.isCurrent && t.active!==false)?.id ?? '';
  const isTrackSelected=patch.isTrackSelected ?? existing?.isTrackSelected ?? false;
  const selectedTrackId=isTrackSelected
    ? patch.selectedTrackId ?? existing?.selectedTrackId ?? null : null;
  const desiredTrackIds=isTrackSelected ? [] : patch.desiredTrackIds ?? existing?.desiredTrackIds ?? [];
  const provinceId=patch.provinceId!==undefined
    ? patch.provinceId || null : existing?.provinceId ?? null;

  const campus=db.campuses.find(c=>c.id===campusId && c.universityId===universityId && c.active!==false);
  const major=db.majors.find(m=>m.id===majorId && m.degreeLevelId===degreeLevelId && m.active!==false);
  if (!db.universities.some(u=>u.id===universityId && u.active!==false) ||
      !campus || !db.degreeLevels.some(d=>d.id===degreeLevelId && d.active!==false) ||
      !major || !db.entryYears.some(y=>y.id===entryYearId && y.active!==false) ||
      !db.academicTerms.some(t=>t.id===currentTermId) ||
      (provinceId && !db.provinces.some(p=>p.id===provinceId && p.active!==false))) {
    return res.status(400).json({success:false,
      error:'واحد دانشگاهی، مقطع، رشته، ورودی، نیمسال یا استان با اطلاعات آموزشی ثبت‌شده سازگار نیست.'});
  }
  if ((isTrackSelected && !db.tracks.some(t=>
        t.id===selectedTrackId && t.majorId===majorId && t.active!==false)) ||
      !Array.isArray(desiredTrackIds) ||
      new Set(desiredTrackIds).size!==desiredTrackIds.length ||
      desiredTrackIds.some(id=>!db.tracks.some(t=>t.id===id && t.majorId===majorId && t.active!==false))) {
    return res.status(400).json({success:false,
      error:'گرایش رسمی یا گرایش‌های مدنظر باید متعلق به رشتهٔ انتخاب‌شده باشند.'});
  }

  // Existing semester plans cannot be silently reinterpreted for a different
  // campus/degree/major/cohort. Students must explicitly clear their CURRENT
  // plan before making a fundamental academic identity change.
  const moved=Boolean(existing && (
    existing.universityId!==universityId || existing.campusId!==campusId ||
    existing.degreeLevelId!==degreeLevelId || existing.majorId!==majorId ||
    existing.entryYearId!==entryYearId));
  if(moved && db.studentPlans.some(p=>p.userId===userId &&
    p.termId===(existing?.currentTermId || currentTermId) &&
    p.selectedOfferingIds.length>0)) {
    return res.status(409).json({success:false,
      error:'برای تغییر واحد، مقطع، رشته یا ورودی ابتدا برنامهٔ انتخابی همین نیمسال را خالی کنید؛ هیچ درسی خودکار پاک نشد.'});
  }

  const updatedProfile:StudentAcademicProfile={
    ...(existing || {}),userId,universityId,provinceId,campusId,degreeLevelId,
    majorId,entryYearId,currentTermId,isTrackSelected,selectedTrackId,
    desiredTrackIds:[...desiredTrackIds],
    previousTermGpa:patch.previousTermGpa!==undefined
      ? patch.previousTermGpa : existing?.previousTermGpa ?? null,
    // Preserve student number, manual final-semester authorization and its
    // approval notes; they are not writable by this student-facing endpoint.
    studentNumber:existing?.studentNumber,
    isFinalSemesterOverride:existing?.isFinalSemesterOverride,
    finalSemesterNotes:existing?.finalSemesterNotes,
    updatedAt:new Date().toISOString(),
  };
  if(index>=0)db.studentProfiles[index]=updatedProfile;
  else db.studentProfiles.push(updatedProfile);
  db.save();
  return res.json({success:true,data:updatedProfile});
});

// --- Student-declared Passed Courses ---
// Never count a failed or absent attempt as completed credit. Legacy course
// histories may include repeated attempts: totals count each passed course once.
const isPassedAttempt = (p:StudentPassedCourse):boolean =>
  p.status!=='FAILED' && p.status!=='ABSENT' &&
  (p.status==='PASSED' || p.grade===undefined || (Number.isFinite(p.grade) && p.grade>=10));

studentRouter.get('/passed-courses', authenticate, (req:AuthenticatedRequest,res)=>{
  const userId=req.user!.id;
  const userHistory=db.studentPassedCourses.filter(p=>p.userId===userId);
  const counted=new Set<string>();
  let totalUnits=0;
  const categorySummary:Record<string,number>={};
  const enrichedList=userHistory.map(p=>{
    const course=db.courses.find(c=>c.id===p.courseId);
    if(course && isPassedAttempt(p) && !counted.has(p.courseId)){
      counted.add(p.courseId);
      totalUnits+=course.units;
      categorySummary[course.category]=(categorySummary[course.category]||0)+course.units;
    }
    return {...p,course};
  });
  res.json({success:true,data:{passedCourses:enrichedList,totalUnits,categorySummary}});
});

studentRouter.post('/passed-courses',authenticate,validate(addPassedCourseSchema),
  (req:AuthenticatedRequest,res)=>{
    const userId=req.user!.id;
    const {courseId,grade,termId}=req.body;
    const course=db.courses.find(c=>c.id===courseId);
    if(!course){
      return res.status(400).json({success:false,error:'درس واردشده در بانک دروس یافت نشد.'});
    }
    if(termId && !db.academicTerms.some(t=>t.id===termId)){
      return res.status(400).json({success:false,error:'نیمسال ثبت‌شده برای سابقهٔ درس معتبر نیست.'});
    }
    if(db.studentPassedCourses.some(p=>p.userId===userId && p.courseId===courseId)){
      return res.status(409).json({success:false,error:'این درس قبلاً در سوابق شما ثبت شده است.'});
    }
    const score=grade!==undefined && grade!==''?Number(grade):undefined;
    const newEntry:StudentPassedCourse={
      id:`spc-${randomUUID()}`,userId,courseId,grade:score,
      status:score!==undefined && score<10?'FAILED':'PASSED',
      termId:termId||undefined,passedAt:new Date().toISOString(),
    };
    db.studentPassedCourses.push(newEntry);
    db.save();
    return res.json({success:true,data:{...newEntry,course}});
  });

// Batch replace/add is atomic: reject the entire payload BEFORE removing any
// historical records. Never silently drop unknown course IDs after replaceAll.
studentRouter.post('/passed-courses/batch',authenticate,validate(batchPassedCoursesSchema),
  (req:AuthenticatedRequest,res)=>{
    const userId=req.user!.id;
    const {courseIds,replaceAll}=req.body as {courseIds:string[];replaceAll?:boolean};
    const uniqueIds=[...new Set(courseIds)];
    const availableIds=new Set(db.courses.map(c=>c.id));
    const unknown=uniqueIds.filter(id=>!availableIds.has(id));
    if(unknown.length){
      return res.status(400).json({success:false,
        error:'فهرست شامل درس تعریف‌نشده است؛ هیچ سابقه‌ای تغییر نکرد.',
        invalidIds:unknown});
    }
    const existing=replaceAll?[]:db.studentPassedCourses.filter(p=>p.userId===userId);
    const existingCourseIds=new Set(existing.map(p=>p.courseId));
    const newRecords:StudentPassedCourse[]=[];
    for(const courseId of uniqueIds){
      if(existingCourseIds.has(courseId))continue;
      newRecords.push({
        id:`spc-${randomUUID()}`,userId,courseId,status:'PASSED',
        passedAt:new Date().toISOString(),
      });
      existingCourseIds.add(courseId);
    }
    if(replaceAll){
      db.data.studentPassedCourses=db.studentPassedCourses.filter(p=>p.userId!==userId);
    }
    db.studentPassedCourses.push(...newRecords);
    db.save();
    return res.json({success:true,addedCount:newRecords.length,
      totalPassed:existingCourseIds.size});
  });

studentRouter.delete('/passed-courses/:id',authenticate,(req:AuthenticatedRequest,res)=>{
  const userId=req.user!.id;
  const idx=db.studentPassedCourses.findIndex(p=>
    p.id===req.params.id && p.userId===userId);
  if(idx===-1)return res.status(404).json({success:false,
    error:'رکورد درس پاس‌شده یافت نشد.'});
  db.studentPassedCourses.splice(idx,1);
  db.save();
  return res.json({success:true,message:'درس از سوابق خوداظهاری حذف شد.'});
});

// --- Student Course Planning & Authoritative Selection ---

// Get current saved plan
studentRouter.get('/plan', authenticate, (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const profile = db.studentProfiles.find((p) => p.userId === userId);
  const currentTermId = profile?.currentTermId || db.academicTerms.find((t) => t.isCurrent)?.id || 'term-1405-1';

  let plan = db.studentPlans.find((p) => p.userId === userId && p.termId === currentTermId);
  if (!plan) {
    plan = {
      id: `plan-${userId}-${currentTermId}`,
      userId,
      termId: currentTermId,
      selectedOfferingIds: [],
      coursePriorities: {},
      offeringPriorities: {},
      updatedAt: new Date().toISOString(),
    };
    // GET must be side-effect free. Persist a plan only after a successful
    // mutation, not merely because the user opened the planner screen.
  }

  res.json({ success: true, data: plan });
});

// Update whole plan (e.g. sync priorities or offerings)
studentRouter.put('/plan', authenticate, validate(updatePlanSchema), (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { selectedOfferingIds, coursePriorities, offeringPriorities, qualitySuggestion } = req.body;
  const profile = db.studentProfiles.find((p) => p.userId === userId);
  const currentTermId = profile?.currentTermId || db.academicTerms.find((t) => t.isCurrent)?.id || 'term-1405-1';

  // Priority-only saves also need authoritative course/offering scope checks.
  // A fallback choice must belong to its claimed course in this student's
  // campus and semester, even when the selected offerings did not change.
  if(coursePriorities !== undefined || offeringPriorities !== undefined){
    if(!profile)return res.status(409).json({success:false,
      error:'ابتدا پروندهٔ تحصیلی دانشجو را تکمیل کنید.'});
    const priorityError=validatePlanPriorities(
      coursePriorities,offeringPriorities,db.courseOfferings,profile.campusId,currentTermId);
    if(priorityError)return res.status(400).json({success:false,error:priorityError});
  }

  if (Array.isArray(selectedOfferingIds) && selectedOfferingIds.length > 0) {
    if (!profile) {
      return res.status(400).json({ success: false, error: 'پروفایل تحصیلی یافت نشد.' });
    }
    const curriculum = findStudentCurriculum(profile);
    if(!curriculum){
      return res.status(409).json({success:false,
        error:'برای دانشگاه، واحد، مقطع، رشته و ورودی شما چارت فعال معتبری پیدا نشد؛ اطلاعات پروفایل یا چارت را بررسی کنید.'});
    }
    const relevantOfferings = db.courseOfferings.filter(o =>
      o.termId === currentTermId && o.campusId === profile.campusId && o.active !== false);
    const passedCourses = db.studentPassedCourses.filter((spc) => spc.userId === userId);

    const report = evaluateStudentEligibility({
      studentProfile: profile,
      curriculum,
      curriculumCourses: db.curriculumCourses,
      allCourses: db.courses,
      tracks: db.tracks,
      academicRules: db.academicRules,
      passedCourses,
      currentOfferings: relevantOfferings,
      // Validate the requested plan as one atomic semester selection. Both
      // halves of a co-requisite pair must be present; priority-only edits
      // cannot fabricate an enrolled/selected group.
      plannedOfferingIdsInSameTerm: selectedOfferingIds,
    });

    const invalidOfferings = selectedOfferingIds.filter(id => {
      const evalItem = report.results.find((r: any) => r.offeringId === id);
      return !evalItem || !evalItem.canSelect || !evalItem.isEligible || evalItem.overallStatus !== 'AVAILABLE';
    });
    
    if (invalidOfferings.length > 0) {
      return res.status(400).json({ 
        success: false, 
        error: 'برخی از دروس انتخابی دارای منع آیین‌نامه‌ای هستند و قابل ثبت نیستند.',
        invalidIds: invalidOfferings
      });
    }

    // A full-plan write must not bypass the same limits as a one-off add.
    // The official exception is explicit catalog metadata, NEVER a guessed
    // substring in a course name.
    const selectedRows=selectedOfferingIds.map(id=>relevantOfferings.find(o=>o.id===id)!);
    const selectedCourseIds=selectedRows.map(o=>o.courseId);
    if(new Set(selectedCourseIds).size!==selectedCourseIds.length){
      return res.status(409).json({success:false,
        error:'از هر درس تنها یک گروه اصلی می‌توان در برنامه انتخاب کرد.'});
    }
    const selectedUnits=plannedUnitCount(selectedCourseIds,db.courses);
    const limits=db.calculateStudentAcademicLimits(userId);
    if(selectedUnits>limits.effectiveMaxUnits){
      return res.status(400).json({success:false,
        error:`مجموع ${selectedUnits} واحد برنامه از سقف مجاز این نیمسال (${limits.effectiveMaxUnits} واحد) بیشتر است.`});
    }

    // Strictly validate *atomic suggested schedule* saves, without changing the
    // existing manual plan editor's ability to display imperfect draft plans.
    if(qualitySuggestion===true){
      const existing=db.studentPlans.find(p=>p.userId===userId&&p.termId===currentTermId);
      const previous=existing?.selectedOfferingIds||[];
      if(!preservesSelectedCourses(previous,selectedOfferingIds,
        db.courseOfferings.map(o=>({offeringId:o.id,courseId:o.courseId})))){
        return res.status(409).json({
          success:false,error:'پیشنهاد باید فقط گروه‌های همین دروس فعلی را جابه‌جا کند؛ برنامه تغییر نکرد.',
        });
      }
      const quality=evaluateScheduleQuality(report.results,selectedOfferingIds);
      if(quality.activeDays===null){
        return res.status(409).json({
          success:false,error:'گروه‌های پیشنهادشده ساعت معتبر یا ترکیب بدون تداخل ندارند؛ برنامه تغییر نکرد.',
        });
      }
    }
  }

  let plan = db.studentPlans.find((p) => p.userId === userId && p.termId === currentTermId);
  if (!plan) {
    plan = {
      id: `plan-${userId}-${currentTermId}`,
      userId,
      termId: currentTermId,
      selectedOfferingIds: Array.isArray(selectedOfferingIds) ? selectedOfferingIds : [],
      coursePriorities: coursePriorities || {},
      offeringPriorities: offeringPriorities || {},
      updatedAt: new Date().toISOString(),
    };
    db.studentPlans.push(plan);
  } else {
    if (Array.isArray(selectedOfferingIds)) plan.selectedOfferingIds = selectedOfferingIds;
    if (coursePriorities) plan.coursePriorities = coursePriorities;
    if (offeringPriorities) plan.offeringPriorities = offeringPriorities;
    plan.updatedAt = new Date().toISOString();
  }

  db.save();
  res.json({ success: true, data: plan });
});

// Authoritative Add/Remove offering validation endpoint
studentRouter.post('/plan/select', authenticate, validate(planSelectSchema), (req: AuthenticatedRequest, res) => {
  const userId = req.user!.id;
  const { offeringId, action } = req.body; // action: 'add' | 'remove'

  if (!offeringId) {
    return res.status(400).json({ success: false, error: 'شناسه گروه درسی مشخص نشده است.' });
  }

  const profile = db.studentProfiles.find((p) => p.userId === userId);
  if (!profile) {
    return res.status(400).json({ success: false, error: 'پروفایل تحصیلی دانشجو یافت نشد.' });
  }

  const currentTermId = profile.currentTermId || db.academicTerms.find((t) => t.isCurrent)?.id || 'term-1405-1';
  let plan = db.studentPlans.find((p) => p.userId === userId && p.termId === currentTermId);
  const isNewPlan = !plan;
  if (!plan) {
    // Keep a new plan in memory until the selected group passes ALL checks.
    // Otherwise an invalid/unauthorized add leaves an empty persisted record.
    plan = {
      id: `plan-${userId}-${currentTermId}`,
      userId,
      termId: currentTermId,
      selectedOfferingIds: [],
      coursePriorities: {},
      offeringPriorities: {},
      updatedAt: new Date().toISOString(),
    };
  }

  if (action === 'remove') {
    if (isNewPlan) {
      return res.json({success:true,action:'removed',selectedOfferingIds:[]});
    }
    plan.selectedOfferingIds = plan.selectedOfferingIds.filter((id) => id !== offeringId);
    plan.updatedAt = new Date().toISOString();
    db.save();
    return res.json({
      success: true,
      action: 'removed',
      selectedOfferingIds: plan.selectedOfferingIds,
    });
  }

  // Action: 'add' -> Strict Backend Eligibility & Limits Validation
  const targetOffering = db.courseOfferings.find((o) => o.id === offeringId);
  if (!targetOffering) {
    return res.status(404).json({ success: false, error: 'گروه درسی مورد نظر یافت نشد.' });
  }

  const curriculum = findStudentCurriculum(profile);
  if(!curriculum) {
    return res.status(409).json({success:false,
      error:'چارت فعال مربوط به دانشگاه، واحد، مقطع، رشته و ورودی شما یافت نشد.'});
  }

  const relevantOfferings = db.courseOfferings.filter(
    o => o.termId === currentTermId && o.campusId === profile.campusId && o.active !== false
  );
  const passedCourses = db.studentPassedCourses.filter((spc) => spc.userId === userId);

  const report = evaluateStudentEligibility({
    studentProfile: profile,
    curriculum,
    curriculumCourses: db.curriculumCourses,
    allCourses: db.courses,
    tracks: db.tracks,
    academicRules: db.academicRules,
    
    passedCourses,
    currentOfferings: relevantOfferings,
    plannedOfferingIdsInSameTerm: plan.selectedOfferingIds,
  });

  const offeringEval = report.results.find((r: any) => r.offeringId === offeringId);
  if (!offeringEval) {
    return res.status(400).json({
      success: false,
      error: 'امکان ارزیابی تطبیقی این درس وجود ندارد.',
    });
  }

  if (!offeringEval.canSelect || !offeringEval.isEligible || offeringEval.overallStatus !== 'AVAILABLE') {
    return res.status(400).json({
      success: false,
      error: `این درس غیرقابل اخذ است: ${offeringEval.primaryReason || 'پیش‌نیاز یا شرایط لازم احراز نشده است.'}`,
      details: {
        overallStatus: offeringEval.overallStatus,
        primaryReason: offeringEval.primaryReason,
        missingPrerequisites: offeringEval.missingPrerequisites,
        missingCorequisites: offeringEval.missingCorequisites,
      },
    });
  }

  // Academic Units Limit Check
  const academicLimits = db.calculateStudentAcademicLimits(userId);
  const targetCourse = db.courses.find((c) => c.id === targetOffering.courseId);
  const targetUnits = targetCourse?.units || 0;

  const currentSelectedOfferings = db.courseOfferings.filter((o) =>
    plan!.selectedOfferingIds.includes(o.id)
  );

  // Check if another section of the same course is currently selected
  const sameCourseExistingOffering = currentSelectedOfferings.find(
    (o) => o.courseId === targetOffering.courseId && o.id !== targetOffering.id
  );

  const otherCourseIds = new Set(currentSelectedOfferings
    .filter(o => o.courseId !== targetOffering.courseId).map(o=>o.courseId));
  const currentUnits = plannedUnitCount([...otherCourseIds],db.courses);
  const isExtra = targetCourse?.isExtraUnit === true;
  if (!isExtra && currentUnits + targetUnits > academicLimits.effectiveMaxUnits) {
    const limitLabel = academicLimits.isSummer
      ? 'ترم تابستان (۸ واحد)'
      : academicLimits.isFinalSemester
      ? 'ترم آخر (۲۴ واحد)'
      : academicLimits.isGradeA
      ? 'معدل الف (۲۴ واحد)'
      : `عادی (${academicLimits.effectiveMaxUnits} واحد)`;

    return res.status(400).json({
      success: false,
      error: `افزودن این درس (${targetUnits} واحد) باعث عبور از سقف مجاز انتخاب واحد ${limitLabel} می‌شود.`,
    });
  }

  // If a different section of this course was already selected, replace it in selectedOfferingIds
  // and keep it as an alternative in offeringPriorities
  if (sameCourseExistingOffering) {
    plan.selectedOfferingIds = plan.selectedOfferingIds.filter(
      (id) => id !== sameCourseExistingOffering.id
    );
  }

  if (!plan.selectedOfferingIds.includes(offeringId)) {
    plan.selectedOfferingIds.push(offeringId);
  }

  // Update offeringPriorities for this course
  if (!plan.offeringPriorities) plan.offeringPriorities = {};
  const currentCourseOfferings = plan.offeringPriorities[targetOffering.courseId] || [];
  const updatedCourseOfferings = [
    offeringId,
    ...currentCourseOfferings.filter((id) => id !== offeringId),
  ];
  plan.offeringPriorities[targetOffering.courseId] = updatedCourseOfferings;

  plan.updatedAt = new Date().toISOString();
  if(isNewPlan) db.studentPlans.push(plan);
  db.save();

  res.json({
    success: true,
    action: 'added',
    selectedOfferingIds: plan.selectedOfferingIds,
    plan,
  });
});

