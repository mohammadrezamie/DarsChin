import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { db } from '../db/database';
import { authenticate, requirePermission } from '../middleware/auth';
import type { CourseOffering } from '../../src/types';

export const offeringsRouter = Router();

const latinDigits = (value: string) => value.replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
  .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
const asText = (value: unknown): string => typeof value === 'string' ? value.trim() : '';
function optionalClock(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return '';
  if (typeof value !== 'string') return null;
  const normalized = latinDigits(value.trim());
  const match = /^(\d{1,2}):(\d{2})$/.exec(normalized);
  if (!match) return null;
  const hh = Number(match[1]), mm = Number(match[2]);
  if (hh > 23 || mm > 59) return null;
  return String(hh).padStart(2, '0') + ':' + match[2];
}
function clockMinutes(value: string) {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

interface SaveOfferingResult { offering?: CourseOffering; error?: string; }
function prepareOffering(input: Record<string, unknown>, existing?: CourseOffering): SaveOfferingResult {
  const termId = input.termId === undefined ? existing?.termId || '' : asText(input.termId);
  const campusId = input.campusId === undefined ? existing?.campusId || '' : asText(input.campusId);
  const courseId = input.courseId === undefined ? existing?.courseId || '' : asText(input.courseId);
  const groupCode = input.groupCode === undefined ? existing?.groupCode || '01' : asText(input.groupCode);
  const instructor = input.instructor === undefined ? existing?.instructor || '' : asText(input.instructor);
  const dayOfWeek = input.dayOfWeek === undefined ? existing?.dayOfWeek || '' : asText(input.dayOfWeek);
  const rawStart = input.startTime === undefined ? existing?.startTime || '' : input.startTime;
  const rawEnd = input.endTime === undefined ? existing?.endTime || '' : input.endTime;
  const startTime = optionalClock(rawStart);
  const endTime = optionalClock(rawEnd);
  if (!termId || !campusId || !courseId || !groupCode || !instructor) {
    return { error: 'نیمسال، واحد، درس، شماره گروه و مدرس الزامی هستند؛ زمان کلاس می‌تواند اعلام‌نشده باشد.' };
  }
  const course = db.courses.find(row => row.id === courseId && row.active);
  if (!course || !db.academicTerms.some(row => row.id === termId) ||
      !db.campuses.some(row => row.id === campusId)) {
    return { error: 'درس فعال، واحد دانشگاهی یا نیمسال انتخابی معتبر نیست.' };
  }
  if (startTime === null || endTime === null ||
      Boolean(startTime) !== Boolean(endTime) ||
      (startTime !== '' && endTime !== '' && clockMinutes(startTime) >= clockMinutes(endTime))) {
    return { error: 'ساعت شروع و پایان باید هر دو معتبر باشند یا هر دو خالی؛ پایان باید بعد از شروع باشد.' };
  }

  const capacity = input.capacity === undefined ? existing?.capacity ?? 30 : Number(input.capacity);
  const enrolledCount = input.enrolledCount === undefined ? existing?.enrolledCount ?? 0 : Number(input.enrolledCount);
  if (!Number.isSafeInteger(capacity) || capacity < 1 || capacity > 10000 ||
      !Number.isSafeInteger(enrolledCount) || enrolledCount < 0 || enrolledCount > capacity) {
    return { error: 'ظرفیت یا تعداد ثبت‌نامی نامعتبر است.' };
  }
  const enrolledCountKnown = input.enrolledCountKnown === false ? false
    : input.enrolledCount !== undefined ? true : existing?.enrolledCountKnown ?? false;
  const optionalString = (key: string, old?: string) =>
    input[key] === undefined ? old : asText(input[key]) || undefined;

  return { offering: {
    id: existing?.id || `off-manual-${randomUUID()}`,
    termId, campusId, courseId,
    rawCourseCode: course.code, rawCourseName: course.name,
    groupCode, instructor, dayOfWeek,
    startTime: startTime || '', endTime: endTime || '',
    location: optionalString('location', existing?.location),
    capacity, enrolledCount, enrolledCountKnown,
    examDate: optionalString('examDate', existing?.examDate),
    notes: optionalString('notes', existing?.notes),
    source: existing?.source || 'manual',
    active: typeof input.active === 'boolean' ? input.active : existing?.active ?? true,
    ...(existing?.sourceIdentity ? { sourceIdentity: existing.sourceIdentity } : {}),
  } };
}

// Public catalog; student-submitted extension batches do not enter this list.
offeringsRouter.get('/', (req, res) => {
  const { termId, campusId } = req.query;
  let list = db.courseOfferings;
  if (termId) list = list.filter(row => row.termId === termId);
  if (campusId) list = list.filter(row => row.campusId === campusId);
  res.json({ success: true, data: list.map(offering => ({
    ...offering,
    course: db.courses.find(course => course.id === offering.courseId),
  })) });
});

offeringsRouter.post('/', authenticate, requirePermission('offering.manage'), (req, res) => {
  const result = prepareOffering(req.body || {});
  if (!result.offering) return res.status(400).json({ success: false, error: result.error });
  db.courseOfferings.push(result.offering);
  try {
    db.save();
  } catch {
    db.data.courseOfferings = db.courseOfferings.filter(row => row.id !== result.offering!.id);
    return res.status(503).json({ success: false, error: 'گروه درسی ذخیره نشد.' });
  }
  return res.json({ success: true, data: { ...result.offering, course: db.courses.find(c => c.id === result.offering!.courseId) } });
});

offeringsRouter.put('/:id', authenticate, requirePermission('offering.manage'), (req, res) => {
  const index = db.courseOfferings.findIndex(row => row.id === req.params.id);
  if (index < 0) return res.status(404).json({ success: false, error: 'ارائه درس یافت نشد.' });
  const result = prepareOffering(req.body || {}, db.courseOfferings[index]);
  if (!result.offering) return res.status(400).json({ success: false, error: result.error });
  const previous = db.courseOfferings[index];
  db.courseOfferings[index] = result.offering;
  try {
    db.save();
  } catch {
    db.courseOfferings[index] = previous;
    return res.status(503).json({ success: false, error: 'ویرایش گروه درسی ذخیره نشد.' });
  }
  return res.json({ success: true, data: result.offering });
});

offeringsRouter.delete('/:id', authenticate, requirePermission('offering.manage'), (req, res) => {
  const idx = db.courseOfferings.findIndex(row => row.id === req.params.id);
  if (idx < 0) return res.status(404).json({ success: false, error: 'ارائه درس یافت نشد.' });
  const [removed] = db.courseOfferings.splice(idx, 1);
  try {
    db.save();
  } catch {
    db.courseOfferings.splice(idx, 0, removed);
    return res.status(503).json({ success: false, error: 'حذف گروه درسی ذخیره نشد.' });
  }
  return res.json({ success: true, message: 'ارائه درس با موفقیت حذف شد.' });
});
