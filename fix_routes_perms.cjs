const fs = require('fs');
const path = require('path');

function replaceRequires(file, replacements) {
    const p = path.join(process.cwd(), file);
    let content = fs.readFileSync(p, 'utf-8');
    
    // Add requirePermission to imports if not there
    if (!content.includes('requirePermission')) {
        content = content.replace(/import\s*\{\s*authenticate,\s*requireAdmin/g, "import { authenticate, requireAdmin, requirePermission");
        content = content.replace(/import\s*\{\s*authenticate,\s*requireAdmin,\s*requireSuperAdmin\s*\}/g, "import { authenticate, requireAdmin, requireSuperAdmin, requirePermission }");
    }

    replacements.forEach(r => {
        content = content.replace(r.search, r.replace);
    });

    fs.writeFileSync(p, content, 'utf-8');
}

// admin.ts
replaceRequires('server/routes/admin.ts', [
    { search: /requireAdmin, \(req, res\) => \{\n\s*res.json\(\{[\s\S]*?totalUsers/g, replace: "requirePermission('admin.panel.access'), (req, res) => {\n  res.json({      totalUsers" },
    { search: /adminRouter.get\('\/backup', authenticate, requireAdmin/g, replace: "adminRouter.get('/backup', authenticate, requirePermission('backup.manage')" },
    { search: /adminRouter.post\('\/restore', authenticate, requireAdmin/g, replace: "adminRouter.post('/restore', authenticate, requirePermission('backup.manage')" },
    { search: /adminRouter.post\('\/reset-seed', authenticate, requireAdmin/g, replace: "adminRouter.post('/reset-seed', authenticate, requirePermission('system.settings.manage')" },
    { search: /adminRouter.get\('\/academic-settings', authenticate, requireSuperAdmin/g, replace: "adminRouter.get('/academic-settings', authenticate, requirePermission('academic-policy.manage')" },
    { search: /adminRouter.put\('\/academic-settings', authenticate, requireSuperAdmin/g, replace: "adminRouter.put('/academic-settings', authenticate, requirePermission('academic-policy.manage')" },
    { search: /adminRouter.get\('\/students-overview', authenticate, requireAdmin/g, replace: "adminRouter.get('/students-overview', authenticate, requirePermission('student-management.read')" },
    { search: /adminRouter.put\('\/students\/:userId\/final-semester-override', authenticate, requireAdmin/g, replace: "adminRouter.put('/students/:userId/final-semester-override', authenticate, requirePermission('academic-policy.manage')" },
]);

// curriculum.ts
replaceRequires('server/routes/curriculum.ts', [
    { search: /curriculumRouter.post\('\/', authenticate, requireAdmin/g, replace: "curriculumRouter.post('/', authenticate, requirePermission('curriculum.manage')" },
    { search: /curriculumRouter.put\('\/:id', authenticate, requireAdmin/g, replace: "curriculumRouter.put('/:id', authenticate, requirePermission('curriculum.manage')" },
    { search: /curriculumRouter.delete\('\/:id', authenticate, requireAdmin/g, replace: "curriculumRouter.delete('/:id', authenticate, requirePermission('curriculum.manage')" },
    { search: /curriculumRouter.post\('\/:id\/courses', authenticate, requireAdmin/g, replace: "curriculumRouter.post('/:id/courses', authenticate, requirePermission('curriculum.manage')" },
    { search: /curriculumRouter.delete\('\/:id\/courses\/:courseId', authenticate, requireAdmin/g, replace: "curriculumRouter.delete('/:id/courses/:courseId', authenticate, requirePermission('curriculum.manage')" },
    { search: /curriculumRouter.get\('\/rules', authenticate, requireAdmin/g, replace: "curriculumRouter.get('/rules', authenticate, requirePermission('prerequisite.manage')" },
    { search: /curriculumRouter.post\('\/rules', authenticate, requireAdmin/g, replace: "curriculumRouter.post('/rules', authenticate, requirePermission('prerequisite.manage')" },
    { search: /curriculumRouter.delete\('\/rules\/:ruleId', authenticate, requireAdmin/g, replace: "curriculumRouter.delete('/rules/:ruleId', authenticate, requirePermission('prerequisite.manage')" }
]);

// academic.ts
replaceRequires('server/routes/academic.ts', [
    { search: /academicRouter.post\('\/provinces', authenticate, requireAdmin/g, replace: "academicRouter.post('/provinces', authenticate, requirePermission('system.settings.manage')" },
    { search: /academicRouter.post\('\/universities', authenticate, requireAdmin/g, replace: "academicRouter.post('/universities', authenticate, requirePermission('system.settings.manage')" },
    { search: /academicRouter.put\('\/universities\/:id', authenticate, requireAdmin/g, replace: "academicRouter.put('/universities/:id', authenticate, requirePermission('system.settings.manage')" },
    { search: /academicRouter.delete\('\/universities\/:id', authenticate, requireAdmin/g, replace: "academicRouter.delete('/universities/:id', authenticate, requirePermission('system.settings.manage')" },
    { search: /academicRouter.post\('\/campuses', authenticate, requireAdmin/g, replace: "academicRouter.post('/campuses', authenticate, requirePermission('system.settings.manage')" },
    { search: /academicRouter.put\('\/campuses\/:id', authenticate, requireAdmin/g, replace: "academicRouter.put('/campuses/:id', authenticate, requirePermission('system.settings.manage')" },
    { search: /academicRouter.delete\('\/campuses\/:id', authenticate, requireAdmin/g, replace: "academicRouter.delete('/campuses/:id', authenticate, requirePermission('system.settings.manage')" },
    { search: /academicRouter.post\('\/degrees', authenticate, requireAdmin/g, replace: "academicRouter.post('/degrees', authenticate, requirePermission('system.settings.manage')" },
    { search: /academicRouter.post\('\/majors', authenticate, requireAdmin/g, replace: "academicRouter.post('/majors', authenticate, requirePermission('system.settings.manage')" },
    { search: /academicRouter.post\('\/tracks', authenticate, requireAdmin/g, replace: "academicRouter.post('/tracks', authenticate, requirePermission('system.settings.manage')" },
    { search: /academicRouter.delete\('\/tracks\/:id', authenticate, requireAdmin/g, replace: "academicRouter.delete('/tracks/:id', authenticate, requirePermission('system.settings.manage')" },
    { search: /academicRouter.post\('\/entry-years', authenticate, requireAdmin/g, replace: "academicRouter.post('/entry-years', authenticate, requirePermission('system.settings.manage')" },
    { search: /academicRouter.post\('\/terms', authenticate, requireAdmin/g, replace: "academicRouter.post('/terms', authenticate, requirePermission('system.settings.manage')" },
    { search: /academicRouter.post\('\/courses', authenticate, requireAdmin/g, replace: "academicRouter.post('/courses', authenticate, requirePermission('course.create')" },
    { search: /academicRouter.put\('\/courses\/:id', authenticate, requireAdmin/g, replace: "academicRouter.put('/courses/:id', authenticate, requirePermission('course.update')" },
    { search: /academicRouter.delete\('\/courses\/:id', authenticate, requireAdmin/g, replace: "academicRouter.delete('/courses/:id', authenticate, requirePermission('course.delete')" },
]);

// offerings.ts
replaceRequires('server/routes/offerings.ts', [
    { search: /offeringsRouter.post\('\/', authenticate, requireAdmin/g, replace: "offeringsRouter.post('/', authenticate, requirePermission('offering.manage')" },
    { search: /offeringsRouter.put\('\/:id', authenticate, requireAdmin/g, replace: "offeringsRouter.put('/:id', authenticate, requirePermission('offering.manage')" },
    { search: /offeringsRouter.delete\('\/:id', authenticate, requireAdmin/g, replace: "offeringsRouter.delete('/:id', authenticate, requirePermission('offering.manage')" },
]);

// support.ts
replaceRequires('server/routes/support.ts', [
    { search: /supportRouter.get\('\/admin\/tickets', authenticate, requireAdmin/g, replace: "supportRouter.get('/admin/tickets', authenticate, requirePermission('support.manage')" },
    { search: /supportRouter.get\('\/admin\/bugs', authenticate, requireAdmin/g, replace: "supportRouter.get('/admin/bugs', authenticate, requirePermission('support.manage')" },
    { search: /supportRouter.put\('\/admin\/tickets\/:id\/status', authenticate, requireAdmin/g, replace: "supportRouter.put('/admin/tickets/:id/status', authenticate, requirePermission('support.manage')" },
    { search: /supportRouter.put\('\/admin\/bugs\/:id\/status', authenticate, requireAdmin/g, replace: "supportRouter.put('/admin/bugs/:id/status', authenticate, requirePermission('support.manage')" },
]);

console.log('Fixed route perms');
