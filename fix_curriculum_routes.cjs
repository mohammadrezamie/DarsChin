const fs = require('fs');
const path = require('path');
const curPath = path.join(process.cwd(), 'server/routes/curriculum.ts');

let content = fs.readFileSync(curPath, 'utf-8');

// Add import
if (!content.includes('extractSourceCourseIds')) {
  content = content.replace(
    "import {\n  Curriculum,",
    "import { extractSourceCourseIds } from '../utils/academic';\nimport { validate } from '../middleware/validate';\nimport { createAcademicRuleSchema } from '../schemas/academic-rule';\nimport {\n  Curriculum,"
  );
}

// Replace the Rules section
const startIndex = content.indexOf('// Admin: List all Academic Rules');
if (startIndex !== -1) {
  const newRules = `// Admin: List all Academic Rules
curriculumRouter.get('/rules', authenticate, requireAdmin, (req, res) => {
  const enriched = db.data.academicRules.map(r => {
    const targetCourse = db.data.courses.find(c => c.id === r.targetCourseId);
    const curr = db.data.curricula.find(c => c.id === r.curriculumId);
    const major = db.data.majors.find(m => m.id === r.majorId);
    const track = db.data.tracks.find(t => t.id === r.trackId);
    const entryYear = db.data.entryYears.find(ey => ey.id === r.entryYearId);
    return {
      ...r,
      targetCourseName: targetCourse?.name || r.targetCourseId,
      curriculumName: curr?.name || r.curriculumId,
      majorName: major?.name || r.majorId,
      trackName: track?.name || r.trackId,
      entryYearName: entryYear?.year || r.entryYearId,
    };
  });
  res.json({ success: true, data: enriched });
});

// Helper for cycle detection
function hasCycle(targetCourseId, expression, allRules, visited = new Set()) {
  if (visited.has(targetCourseId)) return true;
  visited.add(targetCourseId);
  
  const sourceCourseIds = extractSourceCourseIds(expression);
  for (const sourceId of sourceCourseIds) {
    if (sourceId === targetCourseId) return true; // Direct self-reference
    
    // Check downstream
    const sourceRules = allRules.filter(r => r.targetCourseId === sourceId);
    for (const sr of sourceRules) {
      if (hasCycle(targetCourseId, sr.expression, allRules, new Set(visited))) {
        return true;
      }
    }
  }
  return false;
}

// Admin: Add Academic Rule
curriculumRouter.post('/rules', authenticate, requireAdmin, validate(createAcademicRuleSchema), (req, res) => {
  const {
    curriculumId,
    entryYearId,
    majorId,
    trackId,
    targetCourseId,
    relationshipType,
    expression,
    notes,
  } = req.body;

  // Cycle Detection
  if (hasCycle(targetCourseId, expression, db.data.academicRules)) {
    return res.status(400).json({ success: false, error: 'تعریف این قانون باعث ایجاد حلقه (Circular Dependency) می‌شود و مجاز نیست.' });
  }

  const newRule = {
    id: \`rule-\${Date.now()}\`,
    curriculumId,
    entryYearId: entryYearId || null,
    majorId: majorId || null,
    trackId: trackId || null,
    targetCourseId,
    relationshipType,
    expression,
    notes: notes?.trim() || undefined,
  };

  db.data.academicRules.push(newRule as any);
  db.save();
  res.json({ success: true, data: newRule });
});

// Admin: Delete Academic Rule
curriculumRouter.delete('/rules/:ruleId', authenticate, requireAdmin, (req, res) => {
  const idx = db.data.academicRules.findIndex((r) => r.id === req.params.ruleId);
  if (idx === -1) return res.status(404).json({ success: false, error: 'قانون یافت نشد.' });
  db.data.academicRules.splice(idx, 1);
  db.save();
  res.json({ success: true, message: 'قانون حذف شد.' });
});`;

  content = content.substring(0, startIndex) + newRules;
  fs.writeFileSync(curPath, content, 'utf-8');
  console.log('curriculum routes updated.');
} else {
  console.log('Could not find rule section in curriculum.ts');
}
