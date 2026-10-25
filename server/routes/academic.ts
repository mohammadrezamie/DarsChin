// ============================================================================
// DARSCHYN (درس‌چین) - Academic Entities CRUD Routes
// ============================================================================

import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db/database';
import { authenticate, requireAdmin, requirePermission } from '../middleware/auth';
import { University, Province, Campus, DegreeLevel, Major, Track, EntryYear, AcademicTerm, Course } from '../../src/types';

export const academicRouter = Router();

// Public / Authenticated read-all
academicRouter.get('/all-meta', (req, res) => {
  res.json({
    success: true,
    data: {
      universities: db.universities,
      provinces: db.provinces,
      campuses: db.campuses,
      degreeLevels: db.degreeLevels,
      majors: db.majors,
      tracks: db.tracks,
      entryYears: db.entryYears,
      academicTerms: db.academicTerms,
      courses: db.courses,
    },
  });
});


// --- Provinces CRUD ---
academicRouter.get('/provinces', (req, res) => {
  res.json({ success: true, data: db.provinces });
});
academicRouter.post('/provinces', authenticate, requirePermission('system.settings.manage'), (req, res) => {
  const { name, active = true } = req.body;
  if (!name) return res.status(400).json({ success: false, error: 'نام استان الزامی است.' });
  const newProv: Province = { id: `prov-${Date.now()}`, name: name.trim(), active };
  db.provinces.push(newProv);
  db.save();
  res.json({ success: true, data: newProv });
});

// --- Universities CRUD ---
academicRouter.get('/universities', (req, res) => {
  res.json({ success: true, data: db.universities });
});

academicRouter.post('/universities', authenticate, requirePermission('system.settings.manage'), (req, res) => {
  const { name, code, active = true } = req.body;
  if (!name || !code) return res.status(400).json({ success: false, error: 'نام و کد دانشگاه الزامی است.' });

  const newUniv: University = {
    id: `univ-${Date.now()}`,
    name: name.trim(),
    code: code.trim().toUpperCase(),
    active: !!active,
  };
  db.universities.push(newUniv);
  db.save();
  res.json({ success: true, data: newUniv });
});

academicRouter.put('/universities/:id', authenticate, requirePermission('system.settings.manage'), (req, res) => {
  const idx = db.universities.findIndex((u) => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'دانشگاه یافت نشد.' });
  const { name, code, active } = req.body;
  if (name) db.universities[idx].name = name.trim();
  if (code) db.universities[idx].code = code.trim().toUpperCase();
  if (typeof active === 'boolean') db.universities[idx].active = active;
  db.save();
  res.json({ success: true, data: db.universities[idx] });
});

academicRouter.delete('/universities/:id', authenticate, requirePermission('system.settings.manage'), (req, res) => {
  const idx = db.universities.findIndex((u) => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'دانشگاه یافت نشد.' });
  // Check if any campus references it
  const hasCampuses = db.campuses.some((c) => c.universityId === req.params.id);
  if (hasCampuses) {
    db.universities[idx].active = false;
    db.save();
    return res.json({ success: true, message: 'به دلیل وابستگی اطلاعات، این دانشگاه غیرفعال شد.' });
  }
  db.universities.splice(idx, 1);
  db.save();
  res.json({ success: true, message: 'دانشگاه با موفقیت حذف شد.' });
});

// --- Campuses CRUD ---
academicRouter.get('/campuses', (req, res) => {
  const { universityId } = req.query;
  const list = universityId
    ? db.campuses.filter((c) => c.universityId === universityId)
    : db.campuses;
  res.json({ success: true, data: list });
});

academicRouter.post('/campuses', authenticate, requirePermission('system.settings.manage'), (req, res) => {
  const { universityId = 'univ-azad', provinceId, type = 'PROVINCE_UNIT',
    name, code, active = true } = req.body || {};
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 120 ||
      (code != null && (typeof code !== 'string' || code.trim().length > 50)) ||
      !['PROVINCE_UNIT','INDEPENDENT_UNIT','SPECIAL_UNIT'].includes(type) ||
      !db.universities.some(u=>u.id===universityId&&u.active) ||
      (provinceId && !db.provinces.some(p=>p.id===provinceId&&p.active))) {
    return res.status(400).json({ success:false,
      error:'نام واحد و دانشگاه معتبر را انتخاب کن؛ درج شناسه یا کد ساختگی لازم نیست.' });
  }
  if(db.campuses.some(c=>c.universityId===universityId&&c.name.trim()===name.trim()))
    return res.status(409).json({success:false,error:'واحدی با این نام در همین دانشگاه وجود دارد.'});
  const newCampus: Campus={
    id:'camp-'+randomUUID(),universityId,provinceId:provinceId||null,type,
    name:name.trim(),code:code?.trim()||'INTERNAL-'+randomUUID().slice(0,12).toUpperCase(),
    active:active!==false,
  };
  db.campuses.push(newCampus);db.save();
  return res.json({ success:true,data:newCampus });
});

academicRouter.put('/campuses/:id', authenticate, requirePermission('system.settings.manage'), (req, res) => {
  const idx = db.campuses.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'واحد دانشگاهی یافت نشد.' });
  const { universityId, provinceId, type, name, code, active } = req.body;
  if (universityId) db.campuses[idx].universityId = universityId;
  if (provinceId !== undefined) db.campuses[idx].provinceId = provinceId;
  if (type) db.campuses[idx].type = type;
  if (name) db.campuses[idx].name = name.trim();
  if (code) db.campuses[idx].code = code.trim().toUpperCase();
  if (typeof active === 'boolean') db.campuses[idx].active = active;
  db.save();
  res.json({ success: true, data: db.campuses[idx] });
});

academicRouter.delete('/campuses/:id', authenticate, requirePermission('system.settings.manage'), (req, res) => {
  const idx = db.campuses.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'واحد دانشگاهی یافت نشد.' });
  db.campuses.splice(idx, 1);
  db.save();
  res.json({ success: true, message: 'واحد دانشگاهی حذف شد.' });
});

// --- Degrees & Majors & Tracks ---
academicRouter.get('/degrees', (req, res) => res.json({ success: true, data: db.degreeLevels }));
academicRouter.get('/majors', (req, res) => res.json({ success: true, data: db.majors }));
academicRouter.get('/tracks', (req, res) => res.json({ success: true, data: db.tracks }));

// Human-facing academic creation requires names and contextual selections only.
// INTERNAL-* is an opaque internal reference, never an official academic code.
const internalReference = () => 'INTERNAL-' + randomUUID().slice(0, 12).toUpperCase();
const safeAcademicName = (v: unknown): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 120;
const safeOptionalCode = (v: unknown): v is string | undefined =>
  v === undefined || (typeof v === 'string' && v.trim().length > 0 && v.trim().length <= 50);

academicRouter.post('/degrees', authenticate, requirePermission('system.settings.manage'), (req, res) => {
  const { name, code, active = true } = req.body || {};
  if (!safeAcademicName(name) || !safeOptionalCode(code))
    return res.status(400).json({success:false,error:'نام مقطع الزامی است؛ نیازی به شناسهٔ فنی نیست.'});
  if (db.degreeLevels.some(x=>x.name.trim()===name.trim()))
    return res.status(409).json({success:false,error:'این مقطع قبلاً تعریف شده است.'});
  const record:DegreeLevel={id:'deg-'+randomUUID(),name:name.trim(),
    code:code?.trim()||internalReference(),active:active!==false};
  db.degreeLevels.push(record);db.save();
  return res.json({success:true,data:record});
});

academicRouter.post('/majors', authenticate, requirePermission('system.settings.manage'), (req, res) => {
  const { degreeLevelId, name, code, active = true } = req.body || {};
  if (!safeAcademicName(name) || !safeOptionalCode(code) ||
    !db.degreeLevels.some(d=>d.id===degreeLevelId && d.active))
    return res.status(400).json({success:false,error:'نام رشته و مقطع معتبر لازم است.'});
  if (db.majors.some(m=>m.name.trim()===name.trim() && m.degreeLevelId===degreeLevelId))
    return res.status(409).json({success:false,error:'این رشته در این مقطع قبلاً وجود دارد.'});
  const record:Major={id:'maj-'+randomUUID(),degreeLevelId,name:name.trim(),
    code:code?.trim()||internalReference(),active:active!==false};
  db.majors.push(record);db.save();
  return res.json({success:true,data:record});
});

academicRouter.post('/tracks', authenticate, requirePermission('system.settings.manage'), (req, res) => {
  const { majorId, name, code, active = true } = req.body || {};
  if (!safeAcademicName(name) || !safeOptionalCode(code) ||
    !db.majors.some(m=>m.id===majorId && m.active))
    return res.status(400).json({success:false,error:'عنوان گرایش و رشتهٔ مرتبط معتبر لازم است.'});
  if (db.tracks.some(t=>t.majorId===majorId && t.name.trim()===name.trim()))
    return res.status(409).json({success:false,error:'این گرایش برای رشته و مقطع انتخاب‌شده تکراری است.'});
  const record:Track={id:'trk-'+randomUUID(),majorId,name:name.trim(),
    code:code?.trim()||internalReference(),active:active!==false};
  db.tracks.push(record);db.save();
  return res.json({success:true,data:record});
});

academicRouter.delete('/tracks/:id', authenticate, requirePermission('system.settings.manage'), (req, res) => {
  const idx = db.tracks.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'گرایش یافت نشد.' });
  if (db.demandSurveys.some(s => s.trackIds.includes(req.params.id)) ||
      db.curriculumCourses.some(cc => cc.trackId === req.params.id) ||
      db.studentProfiles.some(p => p.selectedTrackId === req.params.id)) {
    return res.status(409).json({
      success: false, error: 'گرایش در چارت، پروندهٔ دانشجو یا نیازسنجی سابقه دارد و قابل حذف مستقیم نیست.',
    });
  }
  db.tracks.splice(idx, 1);
  db.save();
  res.json({ success: true, message: 'گرایش حذف شد.' });
});

// --- Entry Years & Academic Terms ---
academicRouter.get('/entry-years', (req, res) => res.json({ success: true, data: db.entryYears }));
academicRouter.post('/entry-years', authenticate, requirePermission('system.settings.manage'), (req, res) => {
  const { year, active = true } = req.body || {};
  const parsed=Number(year);
  if(!Number.isInteger(parsed)||parsed<1300||parsed>1600)
    return res.status(400).json({success:false,error:'سال ورود باید چهار رقم شمسی معتبر باشد.'});
  if(db.entryYears.some(e=>e.year===parsed))
    return res.status(409).json({success:false,error:'این سال ورود از قبل تعریف شده است.'});
  const newYear:EntryYear={id:'yr-'+parsed,year:parsed,active:active!==false};
  db.entryYears.push(newYear);db.save();
  return res.json({success:true,data:newYear});
});

academicRouter.get('/terms', (req, res) => res.json({ success: true, data: db.academicTerms }));
academicRouter.post('/terms', authenticate, requirePermission('system.settings.manage'), (req, res) => {
  const { name, year, termNumber, isCurrent = false } = req.body;
  if (isCurrent) {
    db.academicTerms.forEach((t) => (t.isCurrent = false));
  }
  const newTerm: AcademicTerm = {
    id: `term-${year}-${termNumber}`,
    name,
    year: Number(year),
    termNumber: Number(termNumber) as any,
    isCurrent: !!isCurrent,
    active: true,
  };
  db.academicTerms.push(newTerm);
  db.save();
  res.json({ success: true, data: newTerm });
});

// --- Courses CRUD ---
academicRouter.get('/courses', (req, res) => res.json({ success: true, data: db.courses }));

academicRouter.post('/courses', authenticate, requirePermission('course.create'), (req, res) => {
  const { code, name, units, practicalUnits = 0, category, description, active = true, isExtraUnit } = req.body;
  if (!code || !name || units === undefined || !category) {
    return res.status(400).json({ success: false, error: 'کد، نام، تعداد واحد و دسته‌بندی درس الزامی است.' });
  }

  const existing = db.courses.find((c) => c.code.trim() === code.trim());
  if (existing) {
    return res.status(400).json({ success: false, error: 'درسی با این کد قبلاً ثبت شده است.' });
  }

  const newCourse: Course = {
    id: `crs-${Date.now()}`,
    code: code.trim(),
    name: name.trim(),
    units: Number(units),
    practicalUnits: Number(practicalUnits),
    category,
    description: description?.trim() || undefined,
    active: !!active,
  };
  db.courses.push(newCourse);
  db.save();
  res.json({ success: true, data: newCourse });
});

academicRouter.put('/courses/:id', authenticate, requirePermission('course.update'), (req, res) => {
  const idx = db.courses.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'درس یافت نشد.' });
  const { code, name, units, practicalUnits, category, description, active, isExtraUnit } = req.body;
  if (code) db.courses[idx].code = code.trim();
  if (name) db.courses[idx].name = name.trim();
  if (units !== undefined) db.courses[idx].units = Number(units);
  if (practicalUnits !== undefined) db.courses[idx].practicalUnits = Number(practicalUnits);
  if (category) db.courses[idx].category = category;
  if (description !== undefined) db.courses[idx].description = description;
  if (typeof active === 'boolean') db.courses[idx].active = active;
  if (typeof isExtraUnit === 'boolean') db.courses[idx].isExtraUnit = isExtraUnit;
  db.save();
  res.json({ success: true, data: db.courses[idx] });
});

academicRouter.delete('/courses/:id', authenticate, requirePermission('course.delete'), (req, res) => {
  const idx = db.courses.findIndex((c) => c.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'درس یافت نشد.' });
  if (db.curriculumCourses.some(c => c.courseId === req.params.id) ||
      db.demandSurveys.some(s => s.courseIds.includes(req.params.id)) ||
      db.studentPassedCourses.some(p => p.courseId === req.params.id) ||
      db.courseOfferings.some(o => o.courseId === req.params.id) ||
      db.academicRules.some(r => r.targetCourseId === req.params.id)) {
    return res.status(409).json({
      success: false,
      error: 'این درس به چارت، سوابق دانشجو، ارائه یا نیازسنجی وابسته است؛ برای حفظ سوابق قابل حذف مستقیم نیست.',
    });
  }
  db.courses.splice(idx, 1);
  db.save();
  res.json({ success: true, message: 'درس با موفقیت حذف شد.' });
});
