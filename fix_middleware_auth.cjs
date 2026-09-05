const fs = require('fs');
const path = require('path');

const middlewarePath = path.join(process.cwd(), 'server/middleware/auth.ts');
let content = fs.readFileSync(middlewarePath, 'utf-8');

content = content.replace(/if \(user.mobile === '09911902465'\) \{[\s\S]*?\}/, '');

const permissionLogic = `
export function requirePermission(permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const permissions = req.user?.permissions || [];
    const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
    
    if (roles.includes('super-admin')) {
      return next(); // root owner bypass
    }

    if (!permissions.includes(permission)) {
      return res.status(403).json({
        success: false,
        error: \`دسترسی غیرمجاز. نیاز به سطح دسترسی: \${permission}\`,
      });
    }
    next();
  };
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const roles = Array.isArray(req.user?.roles) ? req.user.roles : [];
  const permissions = req.user?.permissions || [];
  if (!roles.includes('super-admin') && !permissions.includes('admin.panel.access')) {
    return res.status(403).json({
      success: false,
      error: 'دسترسی غیرمجاز. فقط مدیران سامانه مجاز به انجام این عملیات هستند.',
    });
  }
  next();
}
`;

content = content.replace(/export function requireAdmin[\s\S]*?next\(\);\n\}/, permissionLogic);

fs.writeFileSync(middlewarePath, content, 'utf-8');
console.log('Fixed Auth middleware');
