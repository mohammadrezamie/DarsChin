const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.cwd(), 'server/db/database.ts');
let content = fs.readFileSync(dbPath, 'utf-8');

const replacement = `
        const rootMobile = process.env.ROOT_OWNER_MOBILE || '09911902465'; // Fallback for local testing so tests don't break
        const rootPassword = process.env.ROOT_OWNER_PASSWORD || '1010'; 
        const rootRecovery = process.env.ROOT_OWNER_RECOVERY_KEY || 'darschyn-root-key';

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
            // Do NOT silently overwrite an existing password
            superAdmin.mobile = rootMobile;
            superAdmin.roles = allRoles;
            superAdmin.permissions = allPerms;
            superAdmin.name = superAdmin.name || 'مدیر ارشد سامانه (Root)';
            this.save();
        }
`;

content = content.replace(/const rootMobile = process\.env\.ROOT_OWNER_MOBILE;[\s\S]*?this\.save\(\);\n        \}/, replacement);
fs.writeFileSync(dbPath, content, 'utf-8');
console.log('Fixed superAdmin block');
