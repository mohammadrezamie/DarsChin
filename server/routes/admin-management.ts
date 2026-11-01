import { Router } from 'express';
import { db } from '../db/database';
import { authenticate, requireSuperAdmin } from '../middleware/auth';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { User, UserRole } from '../../src/types';
import { normalizeIranianMobile } from '../auth/normalize-mobile';

export const adminManagementRouter = Router();

const mobileSchema = z.string().trim().min(1).max(32)
  .transform(normalizeIranianMobile)
  .pipe(z.string().regex(/^09\d{9}$/));
const managerNameSchema = z.string().trim().min(2).max(120)
  .refine(name => !/[\u0000-\u001F\u007F]/.test(name));
const managerPasswordSchema = z.string().min(10).max(128);
const managerPermissionsSchema = z.array(
  z.string().regex(/^[a-z][a-z0-9.-]{0,79}$/)
).max(100).refine(items => new Set(items).size === items.length);
const managerRolesSchema = z.array(z.enum(['student', 'admin']))
  .min(1).max(2).refine(items => new Set(items).size === items.length);
const newManagerSchema = z.object({
  name: managerNameSchema,
  mobile: mobileSchema,
  password: managerPasswordSchema,
  permissions: managerPermissionsSchema.optional(),
  roles: managerRolesSchema.optional(),
}).strict();
const updateManagerSchema = z.object({
  name: managerNameSchema.optional(),
  mobile: mobileSchema.optional(),
  password: z.union([z.literal(''), managerPasswordSchema]).optional(),
  permissions: managerPermissionsSchema.optional(),
  roles: managerRolesSchema.optional(),
}).strict().refine(data => Object.keys(data).length > 0);
const mobileInUse = (mobile: string, exceptUserId?: string) =>
  db.users.some(user => user.id !== exceptUserId && normalizeIranianMobile(user.mobile) === mobile);


// Only the root may inspect administrator identities and grants.
adminManagementRouter.get('/', authenticate, requireSuperAdmin, (req: any, res) => {
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
adminManagementRouter.post('/', authenticate, requireSuperAdmin, (req: any, res) => {
  if (Array.isArray(req.body?.roles) && req.body.roles.includes('super-admin')) {
    return res.status(403).json({ success: false, error: 'ایجاد یا واگذاری نقش مدیر ارشد مجاز نیست.' });
  }
  const parsed = newManagerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'نام، شماره، رمز یا مجوزهای مدیر معتبر نیست.' });
  }
  const { name, mobile, password, permissions, roles } = parsed.data;
  if (roles && !roles.includes('admin')) {
    return res.status(400).json({ success: false, error: 'این مسیر فقط برای ایجاد مدیر است.' });
  }
  if (mobileInUse(mobile)) {
    return res.status(409).json({ success: false, error: 'کاربری با این شماره موبایل وجود دارد.' });
  }

  // Admin creation always preserves the user's student workspace.
  const userRoles: UserRole[] = ['student', 'admin'];

  const newUser: User = {
    id: `usr-${randomUUID()}`,
    name,
    mobile,
    password: bcrypt.hashSync(password, 10),
    roles: userRoles,
    permissions: permissions ?? [],
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

// Only the unique root may update delegated identities.
adminManagementRouter.put('/:id', authenticate, requireSuperAdmin, (req: any, res) => {
  const target = db.users.find(u => u.id === req.params.id);
  if (!target) return res.status(404).json({ success: false, error: 'کاربر یافت نشد.' });
  // The verified reserved root cannot be rewritten through delegated management.
  if (target.id === 'usr-super' || target.roles.includes('super-admin')) {
    return res.status(403).json({ success: false, error: 'هویت مدیر ارشد در این مسیر قابل ویرایش نیست.' });
  }

  if (Array.isArray(req.body?.roles) && req.body.roles.includes('super-admin')) {
    return res.status(403).json({ success: false, error: 'ایجاد یا واگذاری نقش مدیر ارشد مجاز نیست.' });
  }
  const parsed = updateManagerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'داده‌های ویرایش مدیر معتبر نیست.' });
  }
  const { name, mobile, permissions, roles, password } = parsed.data;
  // Refuse a mobile collision *before* mutating any user attribute.
  if (mobile !== undefined && mobileInUse(mobile, target.id)) {
    return res.status(409).json({ success: false, error: 'این شماره موبایل متعلق به حساب دیگری است.' });
  }

  if (name !== undefined) target.name = name;
  if (mobile !== undefined) target.mobile = mobile;
  if (permissions !== undefined) target.permissions = permissions;
  if (roles !== undefined) {
    target.roles = roles.includes('admin') ? ['student', 'admin'] : ['student'];
  }
  if (!target.roles.includes('admin')) {
    target.permissions = [];
    target.demandScopes = [];
  }
  if (password) target.password = bcrypt.hashSync(password, 10);

  // A profile or permission update can change login/authority; force a
  // fresh token rather than leaving old browser sessions apparently valid.
  target.sessionVersion = (target.sessionVersion ?? 0) + 1;
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

// Only root may deactivate or reactivate a delegated administrator.
adminManagementRouter.delete('/:id', authenticate, requireSuperAdmin, (req: any, res) => {
  const target = db.users.find(u => u.id === req.params.id);
  if (!target) return res.status(404).json({ success: false, error: 'کاربر یافت نشد.' });

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

  // Reactivation must not revive a JWT issued before deactivation.
  target.sessionVersion = (target.sessionVersion ?? 0) + 1;
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
