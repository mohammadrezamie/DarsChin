import { describe, expect, it } from 'vitest';
import type { AcademicRule, CurriculumCourse } from '../src/types';
import { buildCourseDependencyGraph, rankCoursesByDependencyImpact } from '../src/domain/course-dependency-impact';

const courses = ['foundation','bridge','a','b','c','d','e','side','end','alternative','coreq'];
const curriculumCourses: CurriculumCourse[] = courses.map((courseId,i) => ({
  id: `c-${i}`, curriculumId: 'chart-main', courseId, classification: 'MAJOR_REQUIRED',
  suggestedSemester: i + 1, active: true,
}));
function rule(id: string, source: string, target: string, type: 'PREREQUISITE'|'COREQUISITE' = 'PREREQUISITE'): AcademicRule {
  return { id, curriculumId: 'chart-main', targetCourseId: target, relationshipType:type,
    expression:{type:'COURSE', courseId:source} };
}
const rules = [
  rule('r1','foundation','bridge'), ...['a','b','c','d','e'].map((to,i) => rule(`r${i+2}`,'bridge',to)),
  rule('r-side','side','end'), rule('core','coreq','foundation','COREQUISITE'),
];

describe('full-curriculum dependency impact, not immediate-only importance', () => {
  it('ranks a foundation higher when it unlocks a bridge and five downstream courses', () => {
    const graph = buildCourseDependencyGraph('chart-main',curriculumCourses,rules);
    const ranked = rankCoursesByDependencyImpact(graph.courseIds,graph.links);
    const foundation = ranked.find(x=>x.courseId==='foundation')!;
    const bridge = ranked.find(x=>x.courseId==='bridge')!;
    const side = ranked.find(x=>x.courseId==='side')!;
    expect(foundation.directlyUnlocks).toBe(1);
    expect(foundation.downstreamCourses).toBe(6);
    expect(foundation.longestChain).toBe(2);
    expect(foundation.requiredDownstream).toBe(6);
    expect(bridge.downstreamCourses).toBe(5);
    expect(side.downstreamCourses).toBe(1);
    expect(ranked[0].courseId).toBe('foundation');
    expect(foundation.impactScore).toBeGreaterThan(bridge.impactScore);
    expect(graph.links.find(e=>e.source==='coreq')).toMatchObject({kind:'corequisite',conditional:false});
  });

  it('counts shared descendants once even with convergent prerequisite branches',()=>{
    const graph=buildCourseDependencyGraph('chart-main',curriculumCourses,[
      rule('a','foundation','a'),rule('b','foundation','b'),rule('c','a','c'),rule('d','b','c'),
    ]);
    const foundation=rankCoursesByDependencyImpact(graph.courseIds,graph.links)
      .find(x=>x.courseId==='foundation')!;
    expect(foundation.downstreamCourses).toBe(3);
    expect(foundation.directlyUnlocks).toBe(2);
  });

  it('treats OR branches as possible, not guaranteed, downstream gates',()=>{
    const graph=buildCourseDependencyGraph('chart-main',curriculumCourses,[{
      id:'alternatives',curriculumId:'chart-main',targetCourseId:'bridge',
      relationshipType:'PREREQUISITE',
      expression:{type:'GROUP',operator:'OR',operands:[
        {type:'COURSE',courseId:'foundation'},{type:'COURSE',courseId:'alternative'},
      ]},
    },rule('child','bridge','end')]);
    const ranked=rankCoursesByDependencyImpact(graph.courseIds,graph.links);
    const foundation=ranked.find(x=>x.courseId==='foundation')!;
    expect(foundation.downstreamCourses).toBe(2);
    expect(foundation.requiredDownstream).toBe(0);
    expect(foundation.conditionalDownstream).toBe(2);
    expect(foundation.impactScore).toBe(1);
    expect(graph.links.find(l=>l.source==='foundation')?.conditional).toBe(true);
  });

  it('keeps co-requisites visual and does not score mutual corequisites as a cycle',()=>{
    const graph=buildCourseDependencyGraph('chart-main',curriculumCourses,[
      rule('one','foundation','bridge','COREQUISITE'),rule('two','bridge','foundation','COREQUISITE'),
    ]);
    const ranked=rankCoursesByDependencyImpact(graph.courseIds,graph.links);
    expect(ranked.find(x=>x.courseId==='foundation')?.downstreamCourses).toBe(0);
    expect(graph.links.every(l=>l.kind==='corequisite')).toBe(true);
  });

  it('fails closed for prerequisite cycles, self-dependency and unknown course IDs',()=>{
    const cyc=buildCourseDependencyGraph('chart-main',curriculumCourses,[
      rule('a','foundation','bridge'),rule('b','bridge','foundation'),
    ]);
    expect(()=>rankCoursesByDependencyImpact(cyc.courseIds,cyc.links)).toThrow(/Cyclic/);
    expect(()=>buildCourseDependencyGraph('chart-main',curriculumCourses,[
      rule('self','foundation','foundation'),
    ])).toThrow(/own prerequisite/);
    expect(()=>buildCourseDependencyGraph('chart-main',curriculumCourses,[
      rule('missing','missing-id','foundation'),
    ])).toThrow(/Unknown prerequisite/);
  });

  it('cannot leak or count rules belonging to other charts',()=>{
    const second=[...rules,{...rule('external','side','foundation'),curriculumId:'other-chart'}];
    const graph=buildCourseDependencyGraph('chart-main',curriculumCourses,second);
    expect(graph.links.some(l=>l.source==='side' && l.target==='foundation')).toBe(false);
  });
});
