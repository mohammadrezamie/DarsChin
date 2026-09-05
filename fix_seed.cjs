const fs = require('fs');
const path = require('path');
const seedPath = path.join(process.cwd(), 'server/db/seed.ts');
let content = fs.readFileSync(seedPath, 'utf-8');

const newAcademicRules = `  const academicRules: AcademicRule[] = [
    { id: 'pr-1', relationshipType: 'PREREQUISITE', curriculumId: 'curr-ee-1403', targetCourseId: 'crs-math-2', expression: { type: 'COURSE', courseId: 'crs-math-1' } },
    { id: 'pr-2', relationshipType: 'PREREQUISITE', curriculumId: 'curr-ee-1403', targetCourseId: 'crs-diffeq', expression: { type: 'COURSE', courseId: 'crs-math-1' } },
    { id: 'pr-3', relationshipType: 'PREREQUISITE', curriculumId: 'curr-ee-1403', targetCourseId: 'crs-phys-2', expression: { type: 'COURSE', courseId: 'crs-phys-1' } },
    
    { id: 'pr-4', relationshipType: 'PREREQUISITE', curriculumId: 'curr-ee-1403', targetCourseId: 'crs-engmath', expression: { type: 'GROUP', operator: 'AND', operands: [{ type: 'COURSE', courseId: 'crs-diffeq' }, { type: 'COURSE', courseId: 'crs-math-2' }] } },
    { id: 'pr-6', relationshipType: 'PREREQUISITE', curriculumId: 'curr-ee-1403', targetCourseId: 'crs-circ-1', expression: { type: 'GROUP', operator: 'AND', operands: [{ type: 'COURSE', courseId: 'crs-phys-2' }, { type: 'COURSE', courseId: 'crs-math-1' }] } },
    { id: 'pr-8', relationshipType: 'PREREQUISITE', curriculumId: 'curr-ee-1403', targetCourseId: 'crs-circ-2', expression: { type: 'COURSE', courseId: 'crs-circ-1' } },
    { id: 'pr-9', relationshipType: 'PREREQUISITE', curriculumId: 'curr-ee-1403', targetCourseId: 'crs-signals', expression: { type: 'GROUP', operator: 'AND', operands: [{ type: 'COURSE', courseId: 'crs-engmath' }, { type: 'COURSE', courseId: 'crs-circ-1' }] } },
    { id: 'pr-11', relationshipType: 'PREREQUISITE', curriculumId: 'curr-ee-1403', targetCourseId: 'crs-elec-1', expression: { type: 'COURSE', courseId: 'crs-circ-1' } },
    { id: 'pr-12', relationshipType: 'PREREQUISITE', curriculumId: 'curr-ee-1403', targetCourseId: 'crs-elec-2', expression: { type: 'COURSE', courseId: 'crs-elec-1' } },
    { id: 'pr-13', relationshipType: 'PREREQUISITE', curriculumId: 'curr-ee-1403', targetCourseId: 'crs-comp-arch', expression: { type: 'COURSE', courseId: 'crs-logic' } },
    { id: 'pr-14', relationshipType: 'PREREQUISITE', curriculumId: 'curr-ee-1403', targetCourseId: 'crs-micro', expression: { type: 'COURSE', courseId: 'crs-logic' } },
    
    { id: 'pr-15', relationshipType: 'PREREQUISITE', curriculumId: 'curr-ee-1403', trackId: 'trk-digital', targetCourseId: 'crs-fpga', expression: { type: 'GROUP', operator: 'AND', operands: [{ type: 'COURSE', courseId: 'crs-comp-arch' }, { type: 'COURSE', courseId: 'crs-micro' }] } },
    { id: 'pr-16', relationshipType: 'PREREQUISITE', curriculumId: 'curr-ee-1403', trackId: 'trk-telecom', targetCourseId: 'crs-fpga', expression: { type: 'COURSE', courseId: 'crs-comp-arch' } },
    
    { id: 'pr-17', relationshipType: 'PREREQUISITE', curriculumId: 'curr-ee-1403', targetCourseId: 'crs-power-1', expression: { type: 'COURSE', courseId: 'crs-circ-2' } },
    { id: 'pr-18', relationshipType: 'PREREQUISITE', curriculumId: 'curr-ee-1403', trackId: 'trk-power', targetCourseId: 'crs-power-lab', expression: { type: 'COURSE', courseId: 'crs-power-1' } },
    
    { id: 'cr-1', relationshipType: 'COREQUISITE', curriculumId: 'curr-ee-1403', targetCourseId: 'crs-circ-lab', expression: { type: 'COURSE', courseId: 'crs-circ-1' } }
  ];`;

// Find the start and end of academicRules array
const startIndex = content.indexOf('const academicRules: AcademicRule[] = [');
if (startIndex !== -1) {
  const endIndex = content.indexOf('  const courseOfferings', startIndex);
  if (endIndex !== -1) {
    content = content.substring(0, startIndex) + newAcademicRules + '\n\n' + content.substring(endIndex);
    fs.writeFileSync(seedPath, content, 'utf-8');
    console.log('Seed data updated.');
  } else {
    console.log('End index not found');
  }
} else {
  console.log('Start index not found');
}
