import { Router } from 'express';
import { db } from '../db/database';
import { authenticate, requirePermission, requireSuperAdmin } from '../middleware/auth';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { User, UserRole } from '../../src/types';

export const adminManagementRouter = Router();

// Get all admins (requires admin.manage or admin.create)
adminManagementRouter.get('/', authenticate, (req: any, res) => {
  const perms = req.user.permissions || [];
  const isSuper = req.user.roles.includes('super-admin');
  
  if (!isSuper && !perms.includes('admin.manage') && !perms.includes('admin.create')) {
    return res.status(403).json({ success: false, error: 'دسترسی غیرمجاز.' });
  }

  const admins = db.users
    .filter(u => u.roles.includes('admin') || u.roles.includes('super-admin'))
    .map(u => ({
      id: u.id,
      name: u.name,
      mobile: u.mobile,
      roles: u.roles,
      permissions: u.permissions || [],
      demandScopes: u.demandScopes || [],
      createdBy: u.createdBy,
      createdAt: u.createdAt,
      deactivatedAt: u.deactivatedAt,
    }));

  res.json({ success: true, data: admins });
});

// Only the root owner can assign an administrator to real student-data scopes.
// Granting demand.manage alone must never give access to another department.
const scopesSchema = z.object({
  scopes: z.array(z.object({
    campusId: z.string().min(1).max(120),
    degreeLevelId: z.string().min(1).max(120),
    majorId: z.string().min(1).max(120),
  }).strict()).max(20),
}).strict();

adminManagementRouter.put('/:id/demand-scopes', authenticate, requireSuperAdmin, (req: any, res) => {
  const parsed = scopesSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'محدودهٔ دسترسی مدیر گروه نامعتبر است.' });
  }
  const target = db.users.find(u => u.id === req.params.id);
  if (!target) return res.status(404).json({ success: false, error: 'مدیر مورد نظر یافت نشد.' });
  if (!target.roles.includes('admin') || target.roles.includes('super-admin')) {
    return res.status(400).json({ success: false, error: 'تنها مدیر عادی می‌تواند محدودهٔ نیازسنجی دریافت کند.' });
  }

  const scopes = parsed.data.scopes;
  const uniqueKeys = new Set(scopes.map(x => [x.campusId,x.degreeLevelId,x.majorId].join(':')));
  if (uniqueKeys.size !== scopes.length || scopes.some(scope =>
    !db.campuses.some(c => c.id === scope.campusId && c.active) ||
    !db.degreeLevels.some(d => d.id === scope.degreeLevelId && d.active) ||
    !db.majors.some(m => m.id === scope.majorId && m.degreeLevelId === scope.degreeLevelId && m.active)
  )) return res.status(400).json({ success: false, error: 'محدوده‌ها باید یکتا و بر اساس واحد، مقطع و رشتهٔ معتبر باشند.' });

  target.demandScopes = scopes;
  db.auditLogs.push({
    id: 'audit-demand-scope-' + randomUUID(), adminId: req.user.id,
    action: 'DEMAND_MANAGER_SCOPES_CHANGED', entityType: 'USER', entityId: target.id,
    details: JSON.stringify({ scopes }),
    createdAt: new Date().toISOString(),
  });
  db.save();
  return res.json({ success: true, data: { id: target.id, demandScopes: target.demandScopes } });
});

// Create new admin
adminManagementRouter.post('/', authenticate, requirePermission('admin.create'), (req: any, res) => {
  const { name, mobile, password, permissions, roles } = req.body;
  if (!name || !mobile || !password) {
    return res.status(400).json({ success: false, error: 'نام، موبایل و رمز عبور الزامی است.' });
  }

  const existing = db.users.find(u => u.mobile === mobile);
  if (existing) {
    return res.status(400).json({ success: false, error: 'کاربری با این شماره موبایل وجود دارد.' });
  }

  
  // Ensure delegated admins can only grant permissions they themselves possess
  if (permissions && !req.user.roles.includes('super-admin')) {
      const myPerms = req.user.permissions || [];
      const hasUnallowed = permissions.some((p: string) => !myPerms.includes(p));
      if (hasUnallowed) {
          return res.status(403).json({ success: false, error: 'شما نمی‌توانید دسترسی‌هایی بیشتر از دسترسی‌های خودتان اختصاص دهید.' });
      }
  }

  if (roles !== undefined && !Array.isArray(roles)) {
    return res.status(400).json({ success: false, error: 'ساختار نقش‌ها معتبر نیست.' });
  }
  const allowedRoles: UserRole[] = ['admin', 'student'];
  const userRoles: UserRole[] = roles ? roles.filter((r: any) => allowedRoles.includes(r)) : ['admin'];

  // Exactly one root account is created at bootstrap (id: usr-super).
  // Delegated administrators, including root itself, cannot mint another one.
  if (Array.isArray(roles) && roles.includes('super-admin')) {
    return res.status(403).json({ success: false, error: 'ایجاد مدیر ارشد جدید مجاز نیست.' });
  }

  const newUser: User = {
    id: `usr-${Date.now()}`,
    name,
    mobile,
    password: bcrypt.hashSync(password, 10),
    roles: userRoles,
    permissions: permissions || [],
    createdBy: req.user.id,
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  db.auditLogs.push({
    id: `log-${Date.now()}`,
    adminId: req.user.id,
    action: 'ADMIN_CREATED',
    entityType: 'USER',
    entityId: newUser.id,
    details: `مدیر جدید ${name} توسط ${req.user.name} ایجاد شد.`,
    createdAt: new Date().toISOString(),
  });
  db.save();

  res.json({ success: true, message: 'مدیر با موفقیت ایجاد شد.' });
});

// Update admin (requires admin.manage or root)
adminManagementRouter.put('/:id', authenticate, (req: any, res) => {
  const perms = req.user.permissions || [];
  const isSuper = req.user.roles.includes('super-admin');
  
  if (!isSuper && !perms.includes('admin.manage')) {
    return res.status(403).json({ success: false, error: 'دسترسی غیرمجاز.' });
  }

  const target = db.users.find(u => u.id === req.params.id);
  if (!target) return res.status(404).json({ success: false, error: 'کاربر یافت نشد.' });

  // A delegated admin cannot manage someone they didn't create, UNLESS they are super-admin
  if (!isSuper && target.createdBy !== req.user.id) {
      return res.status(403).json({ success: false, error: 'شما مجاز به ویرایش این کاربر نیستید (فقط کاربران ایجاد شده توسط خودتان).' });
  }
  
  if (target.id === 'usr-super' || target.roles.includes('super-admin')) {
      return res.status(403).json({ success: false, error: 'هویت مدیر ارشد از این مسیر قابل ویرایش نیست.' });
  }

  const { name, mobile, permissions, roles, password } = req.body;
  // Reject invalid escalation BEFORE touching any live in-memory account.
  if (roles !== undefined && (!Array.isArray(roles) || roles.includes('super-admin'))) {
    return res.status(403).json({ success: false, error: 'نقش مدیر ارشد از این مسیر قابل تخصیص نیست.' });
  }
  if (name) target.name = name;
  if (mobile) target.mobile = mobile;
  
  if (permissions && !isSuper) {
      const myPerms = req.user.permissions || [];
      const hasUnallowed = permissions.some((p: string) => !myPerms.includes(p));
      if (hasUnallowed) {
          return res.status(403).json({ success: false, error: 'شما نمی‌توانید دسترسی‌هایی بیشتر از دسترسی‌های خودتان اختصاص دهید.' });
      }
  }

  if (permissions) target.permissions = permissions;
  
  if (roles) {
      const allowedRoles: UserRole[] = ['admin', 'student'];
      const userRoles: UserRole[] = roles.filter((r: any) => allowedRoles.includes(r));
      target.roles = userRoles;
  }

  if (password && password.trim() !== '') {
      target.password = bcrypt.hashSync(password, 10);
  }

  db.auditLogs.push({
    id: `log-${Date.now()}`,
    adminId: req.user.id,
    action: 'ADMIN_UPDATED',
    entityType: 'USER',
    entityId: target.id,
    details: `اطلاعات مدیر ${target.name} ویرایش شد.`,
    createdAt: new Date().toISOString(),
  });
  db.save();

  res.json({ success: true, message: 'اطلاعات با موفقیت بروزرسانی شد.' });
});

// Deactivate admin (requires admin.remove or root)
adminManagementRouter.delete('/:id', authenticate, (req: any, res) => {
  const perms = req.user.permissions || [];
  const isSuper = req.user.roles.includes('super-admin');
  
  if (!isSuper && !perms.includes('admin.remove')) {
    return res.status(403).json({ success: false, error: 'دسترسی غیرمجاز.' });
  }

  const target = db.users.find(u => u.id === req.params.id);
  if (!target) return res.status(404).json({ success: false, error: 'کاربر یافت نشد.' });

  if (!isSuper && target.createdBy !== req.user.id) {
      return res.status(403).json({ success: false, error: 'شما مجاز به غیرفعال‌سازی این کاربر نیستید (فقط کاربران ایجاد شده توسط خودتان).' });
  }

  if (target.roles.includes('super-admin')) {
      return res.status(403).json({ success: false, error: 'غیرفعال‌سازی مدیر ارشد امکان‌پذیر نیست.' });
  }
  
  if (target.deactivatedAt) {
      // Reactivate
      target.deactivatedAt = undefined;
      target.deactivatedBy = undefined;
  } else {
      target.deactivatedAt = new Date().toISOString();
      target.deactivatedBy = req.user.id;
  }

  db.auditLogs.push({
    id: `log-${Date.now()}`,
    adminId: req.user.id,
    action: target.deactivatedAt ? 'ADMIN_DEACTIVATED' : 'ADMIN_REACTIVATED',
    entityType: 'USER',
    entityId: target.id,
    details: `مدیر ${target.name} ${target.deactivatedAt ? 'غیرفعال' : 'فعال'} شد.`,
    createdAt: new Date().toISOString(),
  });
  db.save();

  res.json({ success: true, message: target.deactivatedAt ? 'کاربر غیرفعال شد.' : 'کاربر مجدداً فعال شد.' });
});
