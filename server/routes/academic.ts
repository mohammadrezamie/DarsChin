// ============================================================================
// DARSCHYN (درس‌چین) - Academic Entities CRUD Routes
// ============================================================================

import { Router } from 'express';
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
  const { universityId = 'univ-azad', provinceId, type = 'PROVINCE_UNIT', name, code, active = true } = req.body;
  if (!name || !code) {
    return res.status(400).json({ success: false, error: 'انتخاب دانشگاه و درج نام و کد واحد الزامی است.' });
  }
  const newCampus: Campus = {
    id: `camp-${Date.now()}`,
    universityId,
    provinceId: provinceId || null, type, name: name.trim(),
    code: code.trim().toUpperCase(),
    active: !!active,
  };
  db.campuses.push(newCampus);
  db.save();
  res.json({ success: true, data: newCampus });
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

academicRouter.post('/degrees', authenticate, requirePermission('system.settings.manage'), (req, res) => {
  const { name, code, active = true } = req.body;
  const newDeg: DegreeLevel = { id: `deg-${Date.now()}`, name: name.trim(), code: code.trim().toUpperCase(), active };
  db.degreeLevels.push(newDeg);
  db.save();
  res.json({ success: true, data: newDeg });
});

academicRouter.post('/majors', authenticate, requirePermission('system.settings.manage'), (req, res) => {
  const { degreeLevelId, name, code, active = true } = req.body;
  const newMajor: Major = { id: `maj-${Date.now()}`, degreeLevelId, name: name.trim(), code: code.trim(), active };
  db.majors.push(newMajor);
  db.save();
  res.json({ success: true, data: newMajor });
});

academicRouter.post('/tracks', authenticate, requirePermission('system.settings.manage'), (req, res) => {
  const { majorId, name, code, active = true } = req.body;
  const newTrack: Track = { id: `trk-${Date.now()}`, majorId, name: name.trim(), code: code.trim().toUpperCase(), active };
  db.tracks.push(newTrack);
  db.save();
  res.json({ success: true, data: newTrack });
});

academicRouter.delete('/tracks/:id', authenticate, requirePermission('system.settings.manage'), (req, res) => {
  const idx = db.tracks.findIndex((t) => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'گرایش یافت نشد.' });
  db.tracks.splice(idx, 1);
  db.save();
  res.json({ success: true, message: 'گرایش حذف شد.' });
});

// --- Entry Years & Academic Terms ---
academicRouter.get('/entry-years', (req, res) => res.json({ success: true, data: db.entryYears }));
academicRouter.post('/entry-years', authenticate, requirePermission('system.settings.manage'), (req, res) => {
  const { year, active = true } = req.body;
  const newYear: EntryYear = { id: `yr-${year}`, year: Number(year), active };
  db.entryYears.push(newYear);
  db.save();
  res.json({ success: true, data: newYear });
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
  db.courses.splice(idx, 1);
  db.save();
  res.json({ success: true, message: 'درس با موفقیت حذف شد.' });
});
