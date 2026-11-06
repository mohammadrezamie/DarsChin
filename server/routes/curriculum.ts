// ============================================================================
// DARSCHYN (درس‌چین) - Curriculum Management & Rule Engine CRUD
// ============================================================================

import { Router, type RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db/database';
import { authenticate, isRootOwner, requireAdmin, requirePermission, type AuthenticatedRequest } from '../middleware/auth';
import { extractSourceCourseIds } from '../../src/utils/academic';
import { analyzeCurriculumDependencies } from '../../src/domain/course-dependency-insights';
import { validate } from '../middleware/validate';
import { createAcademicRuleSchema } from '../schemas/academic-rule';
import {
  Curriculum,
  CurriculumCourse,
  AcademicRule,
} from '../../src/types';

export const curriculumRouter = Router();

// Anonymous and ordinary student requests may read published charts only.
// A supplied Bearer token is actually verified before privileged draft access.
const optionalIdentity: RequestHandler = (req, res, next) => {
  if (!req.headers.authorization) return next();
  return authenticate(req as AuthenticatedRequest, res, next);
};
const canSeeUnpublished = (req: AuthenticatedRequest) =>
  isRootOwner(req.user) || Boolean(req.user?.roles?.includes('admin') &&
    req.user?.permissions?.includes('curriculum.manage'));

// Get full curriculum details with courses & rules
curriculumRouter.get('/', optionalIdentity, (req: AuthenticatedRequest, res) => {
  const { majorId, entryYearId } = req.query;
  let list = canSeeUnpublished(req) ? db.curricula : db.curricula.filter(c => c.status === 'active');
  if (majorId) list = list.filter((c) => c.majorId === majorId);
  if (entryYearId) list = list.filter((c) => c.entryYearId === entryYearId);
  res.json({ success: true, data: list });
});

curriculumRouter.get('/:id/full', optionalIdentity, (req: AuthenticatedRequest, res) => {
  const curriculum = db.curricula.find((c) => c.id === req.params.id);
  if (!curriculum || (curriculum.status !== 'active' && !canSeeUnpublished(req))) {
    return res.status(404).json({ success: false, error: 'چارت درسی یافت نشد.' });
  }

  const assignedCourses = db.curriculumCourses.filter((cc) => cc.curriculumId === curriculum.id);
  const prereqs = db.academicRules.filter((pr) => pr.curriculumId === curriculum.id && pr.relationshipType === 'PREREQUISITE');
  const coreqs = db.academicRules.filter((cr) => cr.curriculumId === curriculum.id && cr.relationshipType === 'COREQUISITE');

  // Populate course details
  const enrichedCourses = assignedCourses.map((ac) => {
    const courseDetails = db.courses.find((c) => c.id === ac.courseId);
    return {
      ...ac,
      course: courseDetails,
    };
  });

  res.json({
    success: true,
    data: {
      curriculum,
      courses: enrichedCourses,
      prerequisites: prereqs,
      corequisites: coreqs,
    },
  });
});

// Admin: Create Curriculum
curriculumRouter.post('/', authenticate, requirePermission('curriculum.manage'), (req, res) => {
  const {
    universityId,
    campusId,
    degreeLevelId,
    majorId,
    entryYearId,
    version,
    name,
    notes,
    status = 'draft',
  } = req.body;

  if (![universityId,campusId,degreeLevelId,majorId,entryYearId,name].every(
    v=>typeof v==='string' && v.trim().length>0 && v.length<=150
  )) return res.status(400).json({success:false,error:'اطلاعات اصلی چارت معتبر نیست.'});
  // New charts are ALWAYS drafts; publication must run scoped validation via PUT.
  if (status !== 'draft') return res.status(400).json({
    success:false,error:'چارت تازه ابتدا باید پیش‌نویس باشد؛ پس از افزودن دروس آن را در پنل فعال کنید.',
  });
  if (!['draft'].includes(status) ||
      (version != null && (typeof version!=='string'||version.length>48)) ||
      (notes != null && (typeof notes!=='string'||notes.length>2000))) {
    return res.status(400).json({success:false,error:'وضعیت، نسخه یا یادداشت چارت معتبر نیست.'});
  }
  if (!db.universities.some(x=>x.id===universityId&&x.active) ||
      !db.campuses.some(x=>x.id===campusId&&x.universityId===universityId&&x.active) ||
      !db.degreeLevels.some(x=>x.id===degreeLevelId&&x.active) ||
      !db.majors.some(x=>x.id===majorId&&x.degreeLevelId===degreeLevelId&&x.active) ||
      !db.entryYears.some(x=>x.id===entryYearId&&x.active)) {
    return res.status(400).json({success:false,error:'دانشگاه، واحد، مقطع، رشته یا ورودی با هم تطابق ندارند.'});
  }
  if(db.curricula.some(x=>x.campusId===campusId&&x.majorId===majorId&&
      x.degreeLevelId===degreeLevelId&&x.entryYearId===entryYearId&&x.version===(version||'1.0'))) {
    return res.status(409).json({success:false,error:'برای این ورودی، نسخهٔ چارت تکراری است.'});
  }

  const newCurriculum: Curriculum = {
    id: 'curr-' + randomUUID(),
    universityId,
    campusId,
    degreeLevelId,
    majorId,
    entryYearId,
    version: version || '1.0',
    name: name.trim(),
    notes: notes?.trim() || undefined,
    status,
    createdAt: new Date().toISOString(),
  };

  db.curricula.push(newCurriculum);
  db.save();
  res.json({ success: true, data: newCurriculum });
});

// Admin: Clone a complete academic chart for another entry year.
// A clone is ALWAYS a draft: no demand surveys, student records, or course offerings
// are carried across cohorts. A manager must review the copied regulations.
curriculumRouter.post('/:id/clone', authenticate, requirePermission('curriculum.manage'), (req, res) => {
  const source=db.curricula.find(item=>item.id===req.params.id);
  if(!source)return res.status(404).json({success:false,error:'چارت مبدأ یافت نشد.'});
  const {entryYearId,version,name,copyRules=true}=req.body||{};
  if(typeof entryYearId!=='string'||!entryYearId.trim()||
     typeof version!=='string'||!version.trim()||version.length>48||
     typeof name!=='string'||!name.trim()||name.length>150||
     typeof copyRules!=='boolean'||Object.keys(req.body||{}).some(key=>
       !['entryYearId','version','name','copyRules'].includes(key))) {
    return res.status(400).json({success:false,error:'ورودی، نام، نسخه یا تنظیمات کپی چارت معتبر نیست.'});
  }
  if(!db.entryYears.some(year=>year.id===entryYearId&&year.active)||
     !db.universities.some(university=>university.id===source.universityId&&university.active)||
     !db.campuses.some(campus=>campus.id===source.campusId&&campus.universityId===source.universityId&&campus.active)||
     !db.degreeLevels.some(degree=>degree.id===source.degreeLevelId&&degree.active)||
     !db.majors.some(major=>major.id===source.majorId&&major.degreeLevelId===source.degreeLevelId&&major.active)) {
    return res.status(400).json({success:false,error:'مقطع، رشته، واحد یا ورودی مقصد فعال و معتبر نیست.'});
  }
  if(entryYearId===source.entryYearId)return res.status(400).json({
    success:false,error:'برای کپی مستقل، ورودی مقصد باید با مبدأ متفاوت باشد.',
  });
  if(db.curricula.some(chart=>chart.universityId===source.universityId&&chart.campusId===source.campusId&&
      chart.degreeLevelId===source.degreeLevelId&&chart.majorId===source.majorId&&
      chart.entryYearId===entryYearId&&chart.version===version.trim())) {
    return res.status(409).json({success:false,error:'این نسخه برای رشته، مقطع و ورودی مقصد قبلاً ثبت شده است.'});
  }
  const sourceCourses=db.curriculumCourses.filter(item=>item.curriculumId===source.id&&item.active!==false);
  if(!sourceCourses.length)return res.status(409).json({
    success:false,error:'چارت مبدأ درس فعال ندارد؛ ابتدا دروس آن را تعریف کنید.',
  });
  if(sourceCourses.some(item=>!db.courses.some(course=>course.id===item.courseId&&course.active)||
       (item.trackId&&!db.tracks.some(track=>track.id===item.trackId&&track.majorId===source.majorId&&track.active)))) {
    return res.status(409).json({success:false,error:'درس یا گرایش نامعتبر در چارت مبدأ وجود دارد؛ ابتدا اصلاح شود.'});
  }
  const ids=[...new Set(sourceCourses.map(item=>item.courseId))];
  const rules=copyRules?db.academicRules.filter(rule=>rule.curriculumId===source.id):[];
  if(rules.some(rule=>(rule.entryYearId&&rule.entryYearId!==source.entryYearId)||
      (rule.majorId&&rule.majorId!==source.majorId)||
      (rule.trackId&&!db.tracks.some(track=>track.id===rule.trackId&&track.majorId===source.majorId&&track.active))||
      !ids.includes(rule.targetCourseId)||
      extractSourceCourseIds(rule.expression).some(id=>!ids.includes(id)))) {
    return res.status(409).json({success:false,error:'قوانین مبدأ با چارت سازگار نیستند؛ پیش از کپی اصلاح کنید یا کپی قوانین را خاموش کنید.'});
  }
  if(copyRules && !analyzeCurriculumDependencies(source.id,ids,rules).valid) {
    return res.status(409).json({success:false,error:'چرخه یا خطای پیش‌نیاز در چارت مبدأ وجود دارد؛ کپی قوانین مجاز نیست.'});
  }
  const clone:Curriculum={
    ...source,id:'curr-'+randomUUID(),entryYearId,version:version.trim(),name:name.trim(),
    notes:'پیش‌نویس مستقل از چارت '+source.name+'؛ قوانین و دروس نیازمند بازبینی برای ورودی جدید.',
    status:'draft',createdAt:new Date().toISOString(),
  };
  const courseCopies:CurriculumCourse[]=sourceCourses.map(row=>({
    ...row,id:'cc-'+randomUUID(),curriculumId:clone.id,
  }));
  const ruleCopies:AcademicRule[]=rules.map(rule=>({
    ...structuredClone(rule),id:'rule-'+randomUUID(),curriculumId:clone.id,
    entryYearId:rule.entryYearId?entryYearId:rule.entryYearId,
  }));
  const auditLen=db.auditLogs.length;
  db.curricula.push(clone);
  db.curriculumCourses.push(...courseCopies);
  db.academicRules.push(...ruleCopies);
  db.auditLogs.push({
    id:'audit-chart-clone-'+randomUUID(),adminId:(req as AuthenticatedRequest).user!.id,
    action:'CURRICULUM_CLONED_DRAFT',entityType:'CURRICULUM',entityId:clone.id,
    createdAt:new Date().toISOString(),
  });
  try {db.save();}
  catch {
    db.data.curricula=db.curricula.filter(row=>row.id!==clone.id);
    db.data.curriculumCourses=db.curriculumCourses.filter(row=>row.curriculumId!==clone.id);
    db.data.academicRules=db.academicRules.filter(row=>row.curriculumId!==clone.id);
    db.auditLogs.splice(auditLen);
    return res.status(503).json({success:false,error:'کپی چارت ذخیره نشد؛ اطلاعات مبدأ و سایر ورودی‌ها حفظ شده‌اند.'});
  }
  return res.status(201).json({
    success:true,data:{curriculum:clone,copiedCourses:courseCopies.length,copiedRules:ruleCopies.length},
  });
});

// Admin: Update Curriculum
curriculumRouter.put('/:id', authenticate, requirePermission('curriculum.manage'), (req, res) => {
  const idx = db.curricula.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'چارت درسی یافت نشد.' });

  const { name, version, status, majorId, entryYearId } = req.body;
  if ((status !== undefined && !['draft','active','archived'].includes(status)) ||
      (name !== undefined && (typeof name!=='string'||!name.trim()||name.length>150)) ||
      (version !== undefined && (typeof version!=='string'||!version.trim()||version.length>48))) {
    return res.status(400).json({success:false,error:'عنوان، نسخه یا وضعیت چارت معتبر نیست.'});
  }
  const existing=db.curricula[idx];
  // A survey owns historical cohort context; never mask its 409 integrity block
  // with a generic 400 for a newly supplied invalid major or entry year.
  if(db.demandSurveys.some(survey=>survey.curriculumId===existing.id)&&
    ((majorId&&majorId!==existing.majorId)||
     (entryYearId&&entryYearId!==existing.entryYearId)||
     (status==='archived'&&db.demandSurveys.some(survey=>
       survey.curriculumId===existing.id&&(survey.status==='OPEN'||survey.status==='DRAFT'))))) {
    return res.status(409).json({success:false,error:'این چارت سابقهٔ نیازسنجی دارد؛ تغییر حوزه یا آرشیو تا بستن نیازسنجی‌ها مجاز نیست.'});
  }
  const futureMajor=majorId||existing.majorId;
  const futureYear=entryYearId||existing.entryYearId;
  if ((majorId && !db.majors.some(m=>m.id===majorId&&m.degreeLevelId===existing.degreeLevelId&&m.active)) ||
      (entryYearId && !db.entryYears.some(y=>y.id===entryYearId&&y.active))) {
    return res.status(400).json({success:false,error:'رشته یا ورودی جدید با مقطع/چارت سازگار نیست.'});
  }
  if (db.curricula.some(other=>other.id!==existing.id&&other.universityId===existing.universityId&&
      other.campusId===existing.campusId&&other.degreeLevelId===existing.degreeLevelId&&
      other.majorId===futureMajor&&other.entryYearId===futureYear&&
      other.version===(version||existing.version))) {
    return res.status(409).json({success:false,error:'نسخهٔ چارت برای این رشته و ورودی تکراری است.'});
  }
  if (status==='active') {
    const assigned=db.curriculumCourses.filter(link=>link.curriculumId===existing.id&&link.active!==false);
    if(!assigned.length || assigned.some(link=>!db.courses.some(course=>course.id===link.courseId&&course.active))) {
      return res.status(400).json({success:false,error:'چارت بدون درس فعال یا دارای درس نامعتبر قابل انتشار نیست.'});
    }
    if(db.curricula.some(other=>other.id!==existing.id&&other.status==='active'&&
        other.universityId===existing.universityId&&other.campusId===existing.campusId&&
        other.degreeLevelId===existing.degreeLevelId&&other.majorId===futureMajor&&other.entryYearId===futureYear)) {
      return res.status(409).json({success:false,error:'برای همین رشته و ورودی چارت فعال دیگری وجود دارد.'});
    }
  }
  // Existing surveys are historical records tied to a specific chart and cohort.
  // Never silently reassign that chart to another cohort or major.
  if (db.demandSurveys.some(s => s.curriculumId === req.params.id) &&
      ((majorId && majorId !== db.curricula[idx].majorId) ||
       (entryYearId && entryYearId !== db.curricula[idx].entryYearId) ||
       (status === 'archived' && db.demandSurveys.some(s =>
         s.curriculumId === req.params.id && (s.status === 'OPEN' || s.status === 'DRAFT'))))) {
    return res.status(409).json({ success: false, error: 'این چارت در نیازسنجی استفاده شده؛ تغییر حوزه یا آرشیو پیش از بستن نیازسنجی‌ها مجاز نیست.' });
  }
  const before=structuredClone(db.curricula[idx]);
  if (name) db.curricula[idx].name = name.trim();
  if (version) db.curricula[idx].version = version.trim();
  if (status) db.curricula[idx].status = status;
  if (majorId) db.curricula[idx].majorId = majorId;
  if (entryYearId) db.curricula[idx].entryYearId = entryYearId;

  try { db.save(); }
  catch {
    Object.assign(db.curricula[idx],before);
    return res.status(503).json({success:false,error:'ذخیرهٔ چارت انجام نشد؛ تغییرات قبلی حفظ شده است.'});
  }
  res.json({ success: true, data: db.curricula[idx] });
});

// Admin: Delete Curriculum
curriculumRouter.delete('/:id', authenticate, requirePermission('curriculum.manage'), (req, res) => {
  const idx = db.curricula.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'چارت درسی یافت نشد.' });

  if (db.demandSurveys.some(s => s.curriculumId === req.params.id)) {
    return res.status(409).json({
      success: false,
      error: 'چارت دارای نیازسنجی و سابقهٔ تقاضاست. به‌جای حذف، بعد از بستن نیازسنجی آن را آرشیو کنید.',
    });
  }
  // Only unused charts can be removed; never cascade through survey history.
  db.curricula.splice(idx, 1);
  
  // Cascade delete curriculum courses and rules
  db.data.curriculumCourses = db.curriculumCourses.filter(c => c.curriculumId !== req.params.id);
  db.data.academicRules = db.data.academicRules.filter(c => c.curriculumId !== req.params.id);
  
  db.save();
  res.json({ success: true, message: 'چارت با موفقیت حذف شد.' });
});

// Admin: Assign Course to Curriculum
curriculumRouter.post('/:id/courses', authenticate, requirePermission('curriculum.manage'), (req, res) => {
  const curriculumId = req.params.id;
  const { courseId, trackId, suggestedSemester = 1, classification = 'MAJOR_REQUIRED', categoryOverride } = req.body;
  const curriculum = db.curricula.find(c => c.id === curriculumId);
  if (!curriculum || curriculum.status === 'archived') {
    return res.status(404).json({ success: false, error: 'چارت معتبر و فعال یافت نشد.' });
  }
  if (typeof courseId !== 'string' || !db.courses.some(c => c.id === courseId && c.active)) {
    return res.status(400).json({ success: false, error: 'درس فعال و معتبر انتخاب کنید.' });
  }
  if (trackId && (typeof trackId !== 'string' ||
      !db.tracks.some(t => t.id === trackId && t.majorId === curriculum.majorId && t.active))) {
    return res.status(400).json({ success: false, error: 'گرایش انتخابی متعلق به رشتهٔ این چارت نیست.' });
  }
  const semester = Number(suggestedSemester);
  if (!Number.isInteger(semester) || semester < 1 || semester > 16) {
    return res.status(400).json({ success: false, error: 'ترم پیشنهادی باید یک عدد معتبر باشد.' });
  }
  if (!['MAJOR_REQUIRED','MAJOR_ELECTIVE','TRACK_REQUIRED','TRACK_ELECTIVE'].includes(classification)) {
    return res.status(400).json({ success: false, error: 'نوع درس در چارت معتبر نیست.' });
  }

  const existing = db.curriculumCourses.find(
    (cc) => cc.curriculumId === curriculumId && cc.courseId === courseId && (cc.trackId || null) === (trackId || null)
  );
  if (existing) {
    return res.status(400).json({ success: false, error: 'این درس قبلاً به این چارت/گرایش اضافه شده است.' });
  }

  const newEntry: CurriculumCourse = {
    id: 'cc-' + randomUUID(),
    curriculumId,
    courseId,
    trackId: trackId || null,
    suggestedSemester: semester,
    classification,
    categoryOverride,
    active: true,
  };

  db.curriculumCourses.push(newEntry);
  db.save();
  res.json({ success: true, data: newEntry });
});

// Admin: Remove Course from Curriculum
curriculumRouter.delete('/:id/courses/:courseId', authenticate, requirePermission('curriculum.manage'), (req, res) => {
  const matches = db.curriculumCourses.filter(
    cc => cc.curriculumId === req.params.id && cc.courseId === req.params.courseId
  );
  if (!matches.length) return res.status(404).json({ success: false, error: 'درس در این چارت یافت نشد.' });
  const selectedTrack = typeof req.query.trackId === 'string' ? req.query.trackId : null;
  if (!selectedTrack && matches.length > 1) {
    return res.status(409).json({
      success: false, error: 'این درس برای بیش از یک گرایش ثبت شده؛ گرایش را با trackId مشخص کنید تا درس اشتباه حذف نشود.',
    });
  }
  const assignment = selectedTrack
    ? matches.find(cc => cc.trackId === selectedTrack)
    : matches[0];
  if (!assignment) return res.status(404).json({ success: false, error: 'این درس برای گرایش انتخاب‌شده ثبت نشده است.' });

  if (db.demandSurveys.some(s => s.curriculumId === req.params.id && s.courseIds.includes(req.params.courseId))) {
    return res.status(409).json({
      success: false,
      error: 'این درس در نیازسنجی ثبت شده است و حذف آن می‌تواند گزارش تاریخی مدیر گروه را تخریب کند.',
    });
  }
  db.data.curriculumCourses = db.curriculumCourses.filter(cc => cc.id !== assignment.id);
  // Keep shared prerequisite rules if the same course remains in another track.
  const stillAssigned = db.curriculumCourses.some(cc =>
    cc.curriculumId === req.params.id && cc.courseId === req.params.courseId
  );
  if (!stillAssigned) {
    db.data.academicRules = db.data.academicRules.filter(
      rule => !(rule.curriculumId === req.params.id &&
        (rule.targetCourseId === req.params.courseId ||
         extractSourceCourseIds(rule.expression).includes(req.params.courseId)))
    );
  }
  db.save();
  res.json({ success: true, message: 'انتساب درس به چارت/گرایش حذف شد.' });
});


// Admin: List all Academic Rules
curriculumRouter.get('/rules', authenticate, requirePermission('prerequisite.manage'), (req, res) => {
  const enriched = db.data.academicRules.map(r => {
    const targetCourse = db.data.courses.find(c => c.id === r.targetCourseId);
    const curr = db.data.curricula.find(c => c.id === r.curriculumId);
    const major = db.data.majors.find(m => m.id === r.majorId);
    const track = db.data.tracks.find(t => t.id === r.trackId);
    const entryYear = db.data.entryYears.find(ey => ey.id === r.entryYearId);
    return {
      ...r,
      targetCourseName: targetCourse?.name || r.targetCourseId,
      curriculumName: curr?.name || r.curriculumId,
      majorName: major?.name || r.majorId,
      trackName: track?.name || r.trackId,
      entryYearName: entryYear?.year || r.entryYearId,
    };
  });
  res.json({ success: true, data: enriched });
});

// Admin: Add Academic Rule
curriculumRouter.post('/rules', authenticate, requirePermission('prerequisite.manage'), validate(createAcademicRuleSchema), (req, res) => {
  const {
    curriculumId,
    entryYearId,
    majorId,
    trackId,
    targetCourseId,
    relationshipType,
    expression,
    notes,
  } = req.body;

  const chart = db.curricula.find(item => item.id === curriculumId && item.status !== 'archived');
  if (!chart) {
    return res.status(404).json({ success: false, error: 'چارت انتخابی یافت نشد یا بایگانی شده است.' });
  }
  // Relationships must remain inside their chart/cohort, not be accepted
  // merely because a course exists somewhere in the global catalogue.
  if ((majorId && majorId !== chart.majorId) ||
      (entryYearId && entryYearId !== chart.entryYearId) ||
      (trackId && !db.tracks.some(track => track.id === trackId && track.majorId === chart.majorId && track.active))) {
    return res.status(400).json({ success: false, error: 'حوزهٔ قانون با چارت انتخابی مطابقت ندارد.' });
  }
  const assignedCourseIds = [...new Set(db.curriculumCourses
    .filter(item => item.curriculumId === curriculumId && item.active !== false)
    .map(item => item.courseId))];
  const allowedCourses = new Set(assignedCourseIds);
  const sourceIds = extractSourceCourseIds(expression);
  if (!allowedCourses.has(targetCourseId) || !sourceIds.length ||
      sourceIds.some(id => !allowedCourses.has(id))) {
    return res.status(400).json({
      success: false,
      error: 'درس هدف و همهٔ درس‌های مرتبط باید در چارت انتخابی حضور داشته باشند.',
    });
  }

  // A concurrent tab or another administrator may bypass the visual
  // preview; reject identical standalone edges at the API boundary too.
  if (expression.type === 'COURSE' && db.academicRules.some(rule =>
    rule.curriculumId === curriculumId &&
    rule.targetCourseId === targetCourseId &&
    rule.relationshipType === relationshipType &&
    rule.expression.type === 'COURSE' &&
    rule.expression.courseId === expression.courseId &&
    (rule.entryYearId || null) === (entryYearId || null) &&
    (rule.majorId || null) === (majorId || null) &&
    (rule.trackId || null) === (trackId || null))) {
    return res.status(409).json({ success: false, error: 'این رابطه قبلاً در همین چارت ثبت شده است.' });
  }

  // Validate the entire existing prerequisite graph plus the new edge.
  // The old recursive guard accidentally rejected valid A→B→C chains,
  // and traversed rules belonging to unrelated charts and corequisites.
  // Corequisites may be reciprocal; only prerequisites form the DAG.
  if (relationshipType === 'PREREQUISITE') {
    const candidate = {
      id: 'candidate', curriculumId, targetCourseId,
      relationshipType, expression,
    };
    const analysis = analyzeCurriculumDependencies(
      curriculumId, assignedCourseIds, [...db.academicRules, candidate]
    );
    if (!analysis.valid) {
      return res.status(400).json({
        success: false,
        error: analysis.errors[0] || 'زنجیرهٔ پیش‌نیازها معتبر نیست.',
      });
    }
  }

  const newRule = {
    id: `rule-${randomUUID()}`,
    curriculumId,
    entryYearId: entryYearId || null,
    majorId: majorId || null,
    trackId: trackId || null,
    targetCourseId,
    relationshipType,
    expression,
    notes: notes?.trim() || undefined,
  };

  db.data.academicRules.push(newRule as any);
  db.save();
  res.json({ success: true, data: newRule });
});

// Admin: Delete Academic Rule
curriculumRouter.delete('/rules/:ruleId', authenticate, requirePermission('prerequisite.manage'), (req, res) => {
  const idx = db.data.academicRules.findIndex((r) => r.id === req.params.ruleId);
  if (idx === -1) return res.status(404).json({ success: false, error: 'قانون یافت نشد.' });
  db.data.academicRules.splice(idx, 1);
  db.save();
  res.json({ success: true, message: 'قانون حذف شد.' });
});