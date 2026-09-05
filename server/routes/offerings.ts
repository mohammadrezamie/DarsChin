// ============================================================================
// DARSCHYN (درس‌چین) - Course Offerings CRUD & Offerings Provider Routes
// ============================================================================

import { Router } from 'express';
import { db } from '../db/database';
import { authenticate, requireAdmin } from '../middleware/auth';
import { CourseOffering } from '../../src/types';

export const offeringsRouter = Router();

// List Offerings
offeringsRouter.get('/', (req, res) => {
  const { termId, campusId } = req.query;
  let list = db.courseOfferings;
  if (termId) list = list.filter((o) => o.termId === termId);
  if (campusId) list = list.filter((o) => o.campusId === campusId);

  // Populate course metadata
  const enriched = list.map((o) => {
    const course = db.courses.find((c) => c.id === o.courseId);
    return {
      ...o,
      course,
    };
  });

  res.json({ success: true, data: enriched });
});

// Admin: Create Manual Offering
offeringsRouter.post('/', authenticate, requireAdmin, (req, res) => {
  const {
    termId,
    campusId,
    courseId,
    groupCode = '01',
    instructor,
    dayOfWeek,
    startTime,
    endTime,
    location,
    capacity = 30,
    enrolledCount = 0,
    examDate,
    notes,
  } = req.body;

  if (!termId || !campusId || !courseId || !instructor || !dayOfWeek || !startTime || !endTime) {
    return res.status(400).json({ success: false, error: 'لطفاً تمامی مشخصات اصلی ارائه درس را وارد فرمایید.' });
  }

  const course = db.courses.find((c) => c.id === courseId);

  const newOffering: CourseOffering = {
    id: `off-${Date.now()}`,
    termId,
    campusId,
    courseId,
    rawCourseCode: course?.code,
    rawCourseName: course?.name,
    groupCode: groupCode.trim(),
    instructor: instructor.trim(),
    dayOfWeek: dayOfWeek.trim(),
    startTime: startTime.trim(),
    endTime: endTime.trim(),
    location: location?.trim() || undefined,
    capacity: Number(capacity),
    enrolledCount: Number(enrolledCount),
    examDate: examDate?.trim() || undefined,
    notes: notes?.trim() || undefined,
    source: 'manual',
    active: true,
  };

  db.courseOfferings.push(newOffering);
  db.save();
  res.json({ success: true, data: { ...newOffering, course } });
});

// Admin: Update Offering
offeringsRouter.put('/:id', authenticate, requireAdmin, (req, res) => {
  const idx = db.courseOfferings.findIndex((o) => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'ارائه درس یافت نشد.' });

  const {
    courseId,
    groupCode,
    instructor,
    dayOfWeek,
    startTime,
    endTime,
    location,
    capacity,
    enrolledCount,
    examDate,
    notes,
    active,
  } = req.body;

  if (courseId) db.courseOfferings[idx].courseId = courseId;
  if (groupCode) db.courseOfferings[idx].groupCode = groupCode.trim();
  if (instructor) db.courseOfferings[idx].instructor = instructor.trim();
  if (dayOfWeek) db.courseOfferings[idx].dayOfWeek = dayOfWeek.trim();
  if (startTime) db.courseOfferings[idx].startTime = startTime.trim();
  if (endTime) db.courseOfferings[idx].endTime = endTime.trim();
  if (location !== undefined) db.courseOfferings[idx].location = location.trim();
  if (capacity !== undefined) db.courseOfferings[idx].capacity = Number(capacity);
  if (enrolledCount !== undefined) db.courseOfferings[idx].enrolledCount = Number(enrolledCount);
  if (examDate !== undefined) db.courseOfferings[idx].examDate = examDate;
  if (notes !== undefined) db.courseOfferings[idx].notes = notes;
  if (typeof active === 'boolean') db.courseOfferings[idx].active = active;

  db.save();
  res.json({ success: true, data: db.courseOfferings[idx] });
});

// Admin: Delete Offering
offeringsRouter.delete('/:id', authenticate, requireAdmin, (req, res) => {
  const idx = db.courseOfferings.findIndex((o) => o.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'ارائه درس یافت نشد.' });
  db.courseOfferings.splice(idx, 1);
  db.save();
  res.json({ success: true, message: 'ارائه درس با موفقیت حذف شد.' });
});
