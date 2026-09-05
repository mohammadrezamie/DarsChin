const fs = require('fs');
const path = require('path');
const typesPath = path.join(process.cwd(), 'src/types/index.ts');
let content = fs.readFileSync(typesPath, 'utf-8');

// Replace old AcademicRule with new one
const oldRuleRegex = /export type RelationshipType = [^;]+;\s*export type RuleConditionType = [^;]+;\s*export interface AcademicRule \{[^}]+\}/m;

const newRuleType = `export type RelationshipType = 'PREREQUISITE' | 'COREQUISITE' | 'CONTEXTUAL_RETAKE_RULE';

export type RuleLogicalOperator = 'AND' | 'OR';

export interface AcademicRuleNode {
  type: 'COURSE' | 'GROUP';
  courseId?: string; // If type === 'COURSE'
  operator?: RuleLogicalOperator; // If type === 'GROUP'
  operands?: AcademicRuleNode[]; // If type === 'GROUP'
}

export interface AcademicRule {
  id: string;
  curriculumId: string;
  targetCourseId: string;
  relationshipType: RelationshipType;
  
  // Structured logical expression for the rule
  expression: AcademicRuleNode;
  
  entryYearId?: string | null;
  majorId?: string | null;
  trackId?: string | null;
  
  notes?: string;
}`;

content = content.replace(oldRuleRegex, newRuleType);
fs.writeFileSync(typesPath, content, 'utf-8');
console.log('Types updated.');
