import { describe, expect, it } from 'vitest';
import { analyzeCurriculumDependencies } from '../src/domain/course-dependency-insights';
import { analyzeRemainingGraduationPaths } from '../src/domain/remaining-graduation-path';
import { generateCourseRecommendations, type RecommendationContext } from '../src/domain/recommendation-engine';
import type { AcademicRule, CourseEligibilityResult } from '../src/types';

const edge=(from:string,to:string):AcademicRule=>({
  id:from+'-'+to,curriculumId:'chart',relationshipType:'PREREQUISITE',
  expression:{type:'COURSE',courseId:from},targetCourseId:to,
});
const orRule=(sources:string[],to:string):AcademicRule=>({
  id:'or-'+to,curriculumId:'chart',relationshipType:'PREREQUISITE',targetCourseId:to,
  expression:{type:'GROUP',operator:'OR',operands:sources.map(courseId=>({type:'COURSE',courseId}))},
});
const evalCourse=(courseId:string):CourseEligibilityResult=>({
  offeringId:'off-'+courseId,courseId,courseCode:courseId,courseName:courseId,units:3,
  category:'تخصصی',groupCode:'01',instructor:'Synthetic',dayOfWeek:'شنبه',
  startTime:'08:00',endTime:'09:00',capacity:12,enrolledCount:0,
  overallStatus:'AVAILABLE',isEligible:true,canSelect:true,
  primaryReason:'',allReasons:[],missingPrerequisites:[],missingCorequisites:[],
});
const ctx=(ids:string[],rules:AcademicRule[],eligible:string[]):RecommendationContext=>({
  curriculum:{id:'chart',name:'چارت مصنوعی'} as any,
  allCourses:ids.map(id=>({id,name:id,code:id,units:3,category:'تخصصی',active:true})),
  curriculumCourses:ids.map(courseId=>({id:'cc-'+courseId,curriculumId:'chart',
    courseId,classification:'MAJOR_REQUIRED',active:true} as any)),
  academicRules:rules,eligibilityResults:eligible.map(evalCourse),
});

describe('remaining graduation-path analysis counts real unfinished work',()=>{
  it('preserves traversal through completed middle lessons but not their remaining unit depth',()=>{
    const ids=['a','b','c','d'];
    const graph=analyzeCurriculumDependencies('chart',ids,[edge('a','b'),edge('b','c'),edge('c','d')]);
    const result=analyzeRemainingGraduationPaths(graph,new Set(['b','c'])).get('a')!;
    expect(result.noChoiceFutureCourseIds).toEqual(['d']);
    expect(result.choiceOnlyFutureCourseIds).toEqual([]);
    expect(result.longestRemainingChain).toBe(1);
    expect(result.longestNoChoiceRemainingChain).toBe(1);
  });

  it('distinguishes OR-only descendants from ordinary blocking dependency paths',()=>{
    const ids=['a','x','b','c'];
    const graph=analyzeCurriculumDependencies('chart',ids,[orRule(['a','x'],'b'),edge('b','c')]);
    const result=analyzeRemainingGraduationPaths(graph,new Set()).get('a')!;
    expect(result.noChoiceFutureCourseIds).toEqual([]);
    expect(result.choiceOnlyFutureCourseIds).toEqual(['b','c']);
    expect(result.longestRemainingChain).toBe(2);
    expect(result.longestNoChoiceRemainingChain).toBe(0);
  });

  it('a mandatory diamond path overrides an alternate OR path, and descendants are unique',()=>{
    const ids=['a','b','c','d','x'];
    const graph=analyzeCurriculumDependencies('chart',ids,[
      edge('a','b'),edge('a','c'),edge('b','d'),edge('c','d'),orRule(['a','x'],'d'),
    ]);
    const result=analyzeRemainingGraduationPaths(graph,new Set()).get('a')!;
    expect(result.noChoiceFutureCourseIds).toEqual(['b','c','d']);
    expect(result.choiceOnlyFutureCourseIds).toEqual([]);
    expect(result.longestRemainingChain).toBe(2);
  });

  it('ignores corequisites and refuses fabricated statistics for cyclic graphs',()=>{
    const coreq={...edge('a','b'),relationshipType:'COREQUISITE' as const};
    const first=analyzeCurriculumDependencies('chart',['a','b'],[coreq]);
    expect(analyzeRemainingGraduationPaths(first,new Set()).get('a')!.noChoiceFutureCourseIds).toEqual([]);
    const invalid=analyzeCurriculumDependencies('chart',['a','b'],[edge('a','b'),edge('b','a')]);
    expect(analyzeRemainingGraduationPaths(invalid,new Set()).size).toBe(0);
  });

  it('holds on an end-to-end graduation chain of 120 links without recursion or duplicated counts',()=>{
    const ids=Array.from({length:121},(_,i)=>'course-'+i.toString().padStart(3,'0'));
    const graph=analyzeCurriculumDependencies('chart',ids,ids.slice(1).map((id,i)=>edge(ids[i],id)));
    const passed=new Set(ids.slice(1,101));
    const root=analyzeRemainingGraduationPaths(graph,passed).get(ids[0])!;
    expect(root.noChoiceFutureCourseIds).toHaveLength(20);
    expect(root.longestRemainingChain).toBe(20);
    expect(root.longestNoChoiceRemainingChain).toBe(20);
  });
});

describe('recommendations separate actual bottlenecks from optional alternatives',()=>{
  it('gives a genuine required chain more priority than an OR-only course with more speculative descendants',()=>{
    const ids=['a','b','c','x','y','z','w'];
    const context=ctx(ids,[edge('a','b'),edge('b','c'),orRule(['x','a'],'y'),edge('y','z'),edge('z','w')],['a','x']);
    const ranked=generateCourseRecommendations(context);
    const a=ranked.find(row=>row.courseId==='a')!;
    const x=ranked.find(row=>row.courseId==='x')!;
    expect(a.noChoiceFutureCoursesCount).toBe(2);
    expect(a.choiceOnlyFutureCoursesCount).toBe(3);
    expect(x.noChoiceFutureCoursesCount).toBe(0);
    expect(x.choiceOnlyFutureCoursesCount).toBe(3);
    expect(ranked[0].courseId).toBe('a');
    expect(x.reasons.join(' ')).toContain('الزام قطعی نیستند');
  });

  it('shows remaining steps distinctly from chart depth, with proper transcript filtering',()=>{
    const context=ctx(['a','b','c','d'],[edge('a','b'),edge('b','c'),edge('c','d')],['a']);
    context.completedCourseIds=['b','c'];
    const result=generateCourseRecommendations(context)[0];
    expect(result.unlockedFutureCoursesCount).toBe(1);
    expect(result.noChoiceFutureCoursesCount).toBe(1);
    expect(result.longestPrerequisiteChain).toBe(3);
    expect(result.longestRemainingPrerequisiteChain).toBe(1);
    expect(result.reasons.join(' ')).toContain('۱ گام باقیمانده');
  });

  it('does not turn optional OR-only branches into guaranteed graduation blockers',()=>{
    const context=ctx(['a','b','c','x'],[orRule(['a','x'],'b'),edge('b','c')],['a']);
    const item=generateCourseRecommendations(context)[0];
    expect(item.noChoiceFutureCoursesCount).toBe(0);
    expect(item.choiceOnlyFutureCoursesCount).toBe(2);
    expect(item.unlockedFutureCoursesCount).toBe(2);
    expect(item.reasons.join(' ')).toContain('فقط از مسیرهای دارای شرط «یا»');
  });
});
