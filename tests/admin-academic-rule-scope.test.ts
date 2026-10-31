import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createAcademicRuleSchema } from '../server/schemas/academic-rule';

const base=(expression:unknown)=>({
  curriculumId:'chart',targetCourseId:'target',relationshipType:'PREREQUISITE',
  expression,
});
describe('advanced academic rules: schema safety and chart-scoped UI',()=>{
  it('accepts correctly filled nested AND/OR groups',()=>{
    const valid=base({
      type:'GROUP',operator:'AND',operands:[
        {type:'COURSE',courseId:'math'},
        {type:'GROUP',operator:'OR',operands:[
          {type:'COURSE',courseId:'physics'},
          {type:'COURSE',courseId:'signals'},
        ]},
      ],
    });
    expect(createAcademicRuleSchema.safeParse(valid).success).toBe(true);
  });
  it('rejects incomplete GROUP, missing operator and absent course membership ID',()=>{
    for(const invalid of [
      {type:'GROUP',operator:'AND',operands:[{type:'COURSE',courseId:'math'}]},
      {type:'GROUP',operator:'OR',operands:[]},
      {type:'GROUP',operands:[{type:'COURSE',courseId:'math'},{type:'COURSE',courseId:'physics'}]},
      {type:'COURSE'},
      {type:'COURSE',courseId:'   '},
      {type:'GROUP',operator:'AND',operands:[{type:'COURSE',courseId:'math'},{type:'COURSE'}]},
    ]) expect(createAcademicRuleSchema.safeParse(base(invalid)).success).toBe(false);
  });
  it('rejects unexpected fields and excessive nested sibling operands',()=>{
    expect(createAcademicRuleSchema.safeParse(base({type:'COURSE',courseId:'x',operator:'AND'})).success).toBe(false);
    expect(createAcademicRuleSchema.safeParse(base({
      type:'GROUP',operator:'OR',operands:Array.from({length:31},(_,i)=>({type:'COURSE',courseId:'course-'+i})),
    })).success).toBe(false);
  });
  it('keeps advanced picker scoped to the selected chart and enforces API revision on POST and DELETE',()=>{
    const ui=readFileSync('src/components/AdminAcademicRules.tsx','utf8');
    expect(ui).toContain("'/api/curriculum/' + encodeURIComponent(chartId) + '/full'");
    expect(ui).toContain("'/api/curriculum/rules/history/' + encodeURIComponent(chartId)");
    expect(ui).toContain('courses.filter(course => course.active !== false && activeAdvancedChart.memberIds.has(course.id))');
    expect(ui).toContain('coursesList={scopedCourses}');
    expect(ui).toContain('scopedCourses.map(c =>');
    expect(ui).toContain("headers: { 'If-Match': activeAdvancedChart.revision }");
    expect(ui).toContain("headers: { 'If-Match': version.data!.revision }");
    expect(ui).toContain("targetCourseId: ''");
    expect(ui).toContain("expression: { type: 'COURSE', courseId: '' }");
  });
});
