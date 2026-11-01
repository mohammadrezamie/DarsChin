import { Router } from 'express';
import { db } from '../db/database';
import { authenticate, requirePermission, requireSuperAdmin } from '../middleware/auth';
import bcrypt from 'bcryptjs';
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
      createdBy: u.createdBy,
      createdAt: u.createdAt,
      deactivatedAt: u.deactivatedAt,
    }));

  res.json({ success: true, data: admins });
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

  const allowedRoles: UserRole[] = ['admin', 'student'];
  const userRoles: UserRole[] = roles ? roles.filter((r: any) => allowedRoles.includes(r)) : ['admin'];

  // Ensure super-admin can't be created by regular admin
  if (req.body.roles && req.body.roles.includes('super-admin')) {
      if (!req.user.roles.includes('super-admin')) {
          return res.status(403).json({ success: false, error: 'دسترسی ایجاد مدیر ارشد را ندارید.' });
      }
      userRoles.push('super-admin');
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
  
  if (target.roles.includes('super-admin') && !isSuper) {
      return res.status(403).json({ success: false, error: 'شما مجاز به ویرایش مدیر ارشد نیستید.' });
  }

  const { name, mobile, permissions, roles, password } = req.body;
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
      if (roles.includes('super-admin') && isSuper) userRoles.push('super-admin');
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
