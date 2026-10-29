// ============================================================================
// DARSCHYN (درس‌چین) - Admin Stats, Backup & Reset Routes
// ============================================================================

import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { userDirectoryXlsx } from '../utils/user-excel';
import { db } from '../db/database';
import { InvalidCatalogBackupError } from '../db/catalog-restore';
import { authenticate, requireAdmin, requirePermission, requireSuperAdmin } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { updateRoleSchema, updateAcademicSettingsSchema, overrideFinalSemesterSchema } from '../schemas/admin';

export const adminRouter = Router();

// Get Admin Overview Metrics

adminRouter.get('/stats', authenticate, requirePermission('admin.panel.access'), (req, res) => {
  res.json({
    success: true,
    data: {
      totalUsers: db.users.length,
      totalStudents: db.users.filter((u) => u.roles.includes('student')).length,
      totalUniversities: db.universities.length,
      totalProvinces: db.provinces.length,
      totalCampuses: db.campuses.length,
      totalDegreeLevels: db.degreeLevels.length,
      totalMajors: db.majors.length,
      totalTracks: db.tracks.length,
      totalCurricula: db.curricula.length,
      totalCourses: db.courses.length,
      totalAcademicRules: db.academicRules.length,
      totalOfferings: db.courseOfferings.length,
      totalImports: db.importBatches.length,
    },
  });
});

// Export Database Backup (without sensitive passwords)
adminRouter.get('/backup', authenticate, requirePermission('backup.manage'), (req, res) => {
  res.setHeader('Cache-Control', 'private, no-store');
  const backup = db.exportBackup();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=darschyn-backup-${Date.now()}.json`);
  res.json(backup);
});

// Restore Database Backup
adminRouter.post('/restore', authenticate, requirePermission('backup.manage'), (req, res) => {
  try {
    const backupData = req.body;
    if (!backupData || !Array.isArray(backupData.courses)) {
      return res.status(400).json({ success: false, error: 'فایل پشتیبان معتبر نمی‌باشد.' });
    }
    db.importBackup(backupData);
    res.json({
      success: true,
      message: 'فهرست آموزشی پشتیبان بازیابی شد؛ حساب‌ها، برنامه‌ها، پاسخ‌های دانشجویان و تنظیمات امنیتی فعلی تغییر نکردند.',
    });
  } catch (err: unknown) {
    // Validation errors are bad uploads, never unexpected 500 failures. Do
    // not leak filesystem paths or operational details on write errors.
    if (err instanceof InvalidCatalogBackupError) {
      return res.status(400).json({ success: false, error: err.message });
    }
    res.status(500).json({ success: false, error: 'ذخیرهٔ فایل پشتیبان ناموفق بود؛ وضعیت داده‌ها را پیش از تلاش مجدد بررسی کنید.' });
  }
});

// Reset Database to Original Seed Data
adminRouter.post('/reset-seed', authenticate, requirePermission('system.settings.manage'), (req, res) => {
  if (process.env.NODE_ENV === 'production') {
    return res.status(403).json({
      success: false,
      error: 'بازنشانی داده‌های نمونه در محیط عملیاتی به‌صورت دائمی غیرفعال است.',
    });
  }
  try {
    db.resetToSeed();
    res.json({ success: true, message: 'پایگاه داده به داده‌های آزمایشی اولیه بازنشانی شد.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});


// Root-only export of students/managers as a genuine XLSX. The audit record
// includes filter and count, never the exported phone numbers or names.
adminRouter.get('/users/export.xlsx', authenticate, requireSuperAdmin, (req: any, res) => {
  const role = req.query.role ?? 'all';
  if (typeof role !== 'string' || !['all','student','admin','super-admin'].includes(role)) {
    return res.status(400).json({ success: false, error: 'فیلتر نقش نامعتبر است.' });
  }
  const chosen = db.users.filter(u => role === 'all' || u.roles.includes(role as 'student' | 'admin' | 'super-admin'));
  if (chosen.length > 20_000) {
    return res.status(413).json({ success: false, error: 'خروجی بزرگ است؛ ابتدا نقش کاربران را محدود کنید.' });
  }
  try {
    const profiles = new Map(db.studentProfiles.map(p => [p.userId, p.studentNumber ?? '']));
    const buffer = userDirectoryXlsx(chosen.map(u => ({
      name: u.name ?? '',
      mobile: u.mobile ?? '',
      studentNumber: profiles.get(u.id) ?? '',
      roles: (u.roles ?? []).join('، '),
      verified: u.mobileVerifiedAt ? 'تأییدشده' : 'تأییدنشده',
      permissions: (u.permissions ?? []).join('، '),
    })));
    db.auditLogs.push({
      id: 'audit-user-export-' + randomUUID(),
      adminId: req.user.id, action: 'USER_DIRECTORY_EXPORTED',
      entityType: 'USER', entityId: 'user-directory',
      details: JSON.stringify({ role, count: chosen.length, format: 'xlsx' }),
      createdAt: new Date().toISOString(),
    });
    db.save();
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="darschin-users.xlsx"');
    return res.send(buffer);
  } catch {
    return res.status(500).json({ success: false, error: 'آماده‌سازی خروجی کاربران ناموفق بود.' });
  }
});

// Super Admin: Get Users
adminRouter.get('/users', authenticate, requireSuperAdmin, (req, res) => {
  try {
    const safeUsers = db.users.map((u) => {
      const { password, recoveryKey, ...safe } = u;
      const profile = db.studentProfiles.find(p => p.userId === u.id);
      return {
        ...safe,
        roles: Array.isArray(safe.roles) ? safe.roles : [(safe as any).roles || 'student'],
        profile
      };
    });
    res.json({ success: true, data: safeUsers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Super Admin: Update Role
adminRouter.put('/users/:id/role', authenticate, requireSuperAdmin, validate(updateRoleSchema), (req, res) => {
  try {
    const { role } = req.body;
    if (!['student', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, error: 'نقش انتخاب‌شده نامعتبر است.' });
    }
    const u = db.users.find((x) => x.id === req.params.id);
    if (!u) return res.status(404).json({ success: false, error: 'کاربر مورد نظر یافت نشد.' });
    if (u.id === 'usr-super' || u.roles?.includes('super-admin')) {
      return res.status(403).json({ success: false, error: 'تغییر نقش مدیر ارشد اصلی سامانه امکان‌پذیر نیست.' });
    }
    u.roles =
      role === 'admin'
        ? ['admin', 'student']
        : ['student'];
    db.save();
    res.json({ success: true, message: 'نقش کاربر با موفقیت به‌روزرسانی شد.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});



adminRouter.get('/audit-logs', authenticate, requireSuperAdmin, (req, res) => {
  res.json({ success: true, data: db.auditLogs || [] });
});

adminRouter.get('/error-logs', authenticate, requireSuperAdmin, (req, res) => {
  res.json({ success: true, data: db.errorLogs || [] });
});

adminRouter.get('/academic-settings', authenticate, requirePermission('academic-policy.manage'), (req, res) => {
  res.json({ success: true, data: db.academicSettings });
});

adminRouter.put('/academic-settings', authenticate, requirePermission('academic-policy.manage'), validate(updateAcademicSettingsSchema), (req, res) => {
  try {
    const {
      normalMinUnits,
      normalMaxUnits,
      gpaBonusThreshold,
      gpaBonusMaxUnits,
      summerMinUnits,
      summerMaxUnits,
      finalSemesterMaxUnits,
      finalSemesterThresholdUnits,
      finalSemesterRuleEnabled,
    } = req.body;

    const current = db.academicSettings;
    const updated = {
      ...current,
      normalMinUnits: Number(normalMinUnits) || current.normalMinUnits,
      normalMaxUnits: Number(normalMaxUnits) || current.normalMaxUnits,
      gpaBonusThreshold: Number(gpaBonusThreshold) || current.gpaBonusThreshold,
      gpaBonusMaxUnits: Number(gpaBonusMaxUnits) || current.gpaBonusMaxUnits,
      summerMinUnits: Number(summerMinUnits) || current.summerMinUnits,
      summerMaxUnits: Number(summerMaxUnits) || current.summerMaxUnits,
      finalSemesterMaxUnits: Number(finalSemesterMaxUnits) || current.finalSemesterMaxUnits,
      finalSemesterThresholdUnits: Number(finalSemesterThresholdUnits) || current.finalSemesterThresholdUnits,
      finalSemesterRuleEnabled: finalSemesterRuleEnabled !== undefined ? Boolean(finalSemesterRuleEnabled) : current.finalSemesterRuleEnabled,
    };

    db.academicSettings = updated;
    
    if (db.auditLogs) {
      db.auditLogs.unshift({
        id: `audit-${Date.now()}`,
        adminId: (req as any).user?.id || 'admin',
        action: 'UPDATE_ACADEMIC_SETTINGS',
        entityType: 'AcademicPolicySettings',
        entityId: 'global',
        details: JSON.stringify(updated),
        createdAt: new Date().toISOString(),
      });
    }

    res.json({ success: true, data: db.academicSettings, message: 'تنظیمات آیین‌نامه آموزشی با موفقیت به‌روزرسانی شد.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Get detailed list of students and their final-semester eligibility
adminRouter.get('/students-overview', authenticate, requirePermission('student-management.read'), (req, res) => {
  try {
    const studentUsers = db.users.filter((u) => u.roles.includes('student'));
    const list = studentUsers.map((u) => {
      const profile = db.studentProfiles.find((p) => p.userId === u.id);
      const limits = db.calculateStudentAcademicLimits(u.id);
      const major = profile ? db.majors.find((m) => m.id === profile.majorId) : null;
      return {
        userId: u.id,
        name: u.name,
        mobile: u.mobile,
        majorName: major?.name || 'تعیین‌نشده',
        profile,
        limits,
      };
    });
    res.json({ success: true, data: list });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Admin override for student final-semester status
adminRouter.put('/students/:userId/final-semester-override', authenticate, requirePermission('academic-policy.manage'), validate(overrideFinalSemesterSchema), (req, res) => {
  try {
    const { userId } = req.params;
    const { isFinalSemesterOverride, finalSemesterNotes } = req.body;

    let profile = db.studentProfiles.find((p) => p.userId === userId);
    if (!profile) {
      return res.status(404).json({ success: false, error: 'پروفایل تحصیلی دانشجو یافت نشد.' });
    }

    profile.isFinalSemesterOverride = isFinalSemesterOverride;
    profile.finalSemesterNotes = finalSemesterNotes || '';
    profile.updatedAt = new Date().toISOString();
    db.save();

    const updatedLimits = db.calculateStudentAcademicLimits(userId);

    if (db.auditLogs) {
      db.auditLogs.unshift({
        id: `audit-${Date.now()}`,
        adminId: (req as any).user?.id || 'admin',
        action: 'UPDATE_FINAL_SEMESTER_OVERRIDE',
        entityType: 'StudentAcademicProfile',
        entityId: userId,
        details: JSON.stringify({ isFinalSemesterOverride, finalSemesterNotes }),
        createdAt: new Date().toISOString(),
      });
    }

    res.json({
      success: true,
      message: 'مجوز ترم آخری دانشجو با موفقیت ثبت شد.',
      data: { profile, limits: updatedLimits },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

adminRouter.get('/diagnostics', authenticate, requireSuperAdmin, (req, res) => {
  const memoryUsage = process.memoryUsage();
  res.json({
    success: true,
    data: {
      status: 'HEALTHY',
      uptimeSeconds: Math.floor(process.uptime()),
      databaseStats: {
        users: db.users.length,
        provinces: db.provinces.length,
        campuses: db.campuses.length,
        degreeLevels: db.degreeLevels.length,
        majors: db.majors.length,
        tracks: db.tracks.length,
        entryYears: db.entryYears.length,
        terms: db.academicTerms.length,
        curricula: db.curricula.length,
        courses: db.courses.length,
        curriculumCourses: db.curriculumCourses.length,
        academicRules: db.academicRules.length,
        
        offerings: db.courseOfferings.length,
        studentProfiles: db.studentProfiles.length,
        passedCourses: db.studentPassedCourses.length,
        supportTickets: db.supportTickets.length,
        bugReports: db.bugReports.length,
        auditLogs: db.auditLogs.length,
        errorLogs: db.errorLogs.length,
      },
      memory: {
        rssMb: Math.round(memoryUsage.rss / 1024 / 1024),
        heapTotalMb: Math.round(memoryUsage.heapTotal / 1024 / 1024),
        heapUsedMb: Math.round(memoryUsage.heapUsed / 1024 / 1024),
      },
      nodeVersion: process.version,
      platform: process.platform,
      serverTime: new Date().toISOString(),
    },
  });
});
