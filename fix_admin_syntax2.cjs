const fs = require('fs');
const path = require('path');

const adminPath = path.join(process.cwd(), 'server/routes/admin.ts');
let content = fs.readFileSync(adminPath, 'utf-8');

// The original replacement in the first script was:
// replace: "requirePermission('admin.panel.access'), (req, res) => {\n  res.json({      totalUsers"
// The original was: res.json({\n    success: true,\n    data: {\n      totalUsers

// Let's just restore the whole route block cleanly!

const startIdx = content.indexOf("adminRouter.get('/stats'");
const endIdx = content.indexOf("adminRouter.get('/backup'");
if (startIdx !== -1 && endIdx !== -1) {
    const replacement = `
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
`;
    content = content.substring(0, startIdx) + replacement + content.substring(endIdx + 56);
}

fs.writeFileSync(adminPath, content, 'utf-8');
console.log('Fixed admin route properly');
