const fs = require('fs');
const path = require('path');
const typesPath = path.join(process.cwd(), 'src/utils/academic.ts');
const dir = path.dirname(typesPath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const content = `import { AcademicRuleNode } from '../types';

export function extractSourceCourseIds(node: AcademicRuleNode): string[] {
  if (node.type === 'COURSE' && node.courseId) {
    return [node.courseId];
  } else if (node.type === 'GROUP' && node.operands) {
    return node.operands.flatMap(extractSourceCourseIds);
  }
  return [];
}
`;
fs.writeFileSync(typesPath, content, 'utf-8');
console.log('academic.ts helper created.');
