const fs = require('fs');
const path = require('path');
const uiPath = path.join(process.cwd(), 'src/components/AdminCurriculumBuilder.tsx');

let content = fs.readFileSync(uiPath, 'utf-8');

// Replace the inline rule stuff. Let's just remove the rule addition part from the Curriculum Builder 
// because we have a dedicated Rule Builder now.
const startIndex = content.indexOf('const handleAddRule = async () => {');
if (startIndex !== -1) {
  const endIndex = content.indexOf('// --- UI Renders ---', startIndex);
  if (endIndex !== -1) {
    content = content.substring(0, startIndex) + content.substring(endIndex);
  }
}

// Remove rule UI rendering
const ruleUiStart = content.indexOf('{activeCourseId === cc.courseId && (');
if (ruleUiStart !== -1) {
  const ruleUiEnd = content.indexOf(')}', ruleUiStart);
  if (ruleUiEnd !== -1) {
    // Just remove the block
    content = content.substring(0, ruleUiStart) + content.substring(ruleUiEnd + 2);
  }
}

fs.writeFileSync(uiPath, content, 'utf-8');
console.log('Curriculum builder cleaned up.');
