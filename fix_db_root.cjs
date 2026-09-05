const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.cwd(), 'server/db/database.ts');
let content = fs.readFileSync(dbPath, 'utf-8');

const regex = /const superAdmin = this\.data\.users\.find\(u => u\.mobile === '09911902465' \|\| u\.id === 'usr-super'\);[\s\S]*?this\.save\(\);\n        \}/;

const replacement = `
        const rootMobile = process.env.ROOT_OWNER_MOBILE;
        const rootPassword = process.env.ROOT_OWNER_PASSWORD || '1010'; // default fallback
        const rootRecovery = process.env.ROOT_OWNER_RECOVERY_KEY || 'darschyn-root-key';

        if (rootMobile) {
            let superAdmin = this.data.users.find(u => u.mobile === rootMobile || u.id === 'usr-super');
            
            const allRoles = ['super-admin', 'admin', 'student'];
            const allPerms = [
              'student.access', 'student.profile.read', 'student.plan.manage', 'student.academic.read',
              'admin.panel.access', 'course.read', 'course.create', 'course.update', 'course.delete',
              'prerequisite.manage', 'corequisite.manage', 'curriculum.manage', 'offering.manage',
              'academic-policy.manage', 'student-management.read', 'support.manage', 'import.manage',
              'admin.create', 'admin.manage', 'admin.remove', 'admin.permission.manage',
              'system.settings.manage', 'backup.manage'
            ];

            if (!superAdmin) {
                this.data.users.push({
                    id: 'usr-super',
                    mobile: rootMobile,
                    password: bcrypt.hashSync(rootPassword, 10),
                    recoveryKey: rootRecovery,
                    name: 'مدیر ارشد سامانه (Root)',
                    roles: allRoles,
                    permissions: allPerms,
                    createdAt: new Date().toISOString()
                });
                console.log("ROOT OWNER INJECTED IN LOCAL DATABASE");
                this.save();
            } else {
                // Do NOT silently overwrite an existing password unless it is an old default we explicitly want to migrate
                // We'll just ensure identity and permissions are correct
                superAdmin.mobile = rootMobile;
                superAdmin.roles = allRoles;
                superAdmin.permissions = allPerms; // Always reset root owner perms to everything
                this.save();
            }
        }`;

content = content.replace(regex, replacement);
fs.writeFileSync(dbPath, content, 'utf-8');
console.log('Fixed Root Admin init in DB');
