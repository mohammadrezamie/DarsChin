import { describe, expect, it } from 'vitest';
import { generateCourseRecommendations, type RecommendationContext } from '../src/domain/recommendation-engine';
import type { AcademicRule, CourseEligibilityResult } from '../src/types';

const courses = ['a','b','c','d','x','y'].map(id => ({
  id, name: 'درس ' + id.toUpperCase(), code: id.toUpperCase(),
  units: 3, category: 'تخصصی', active: true,
}));
const evaluation = (id: string): CourseEligibilityResult => ({
  offeringId: 'group-' + id, courseId: id, courseName: 'درس ' + id.toUpperCase(),
  courseCode: id.toUpperCase(), units: 3, category: 'تخصصی', groupCode: '01',
  instructor: 'استاد نمونه', dayOfWeek: 'شنبه', startTime: '08:00', endTime: '10:00',
  capacity: 30, enrolledCount: 0, overallStatus: 'AVAILABLE', canSelect: true,
  isEligible: true, primaryReason: '', allReasons: [],
  missingPrerequisites: [], missingCorequisites: [],
});
const rule = (from: string, to: string, id = from + '-to-' + to): AcademicRule => ({
  id, curriculumId: 'chart', targetCourseId: to,
  relationshipType: 'PREREQUISITE', expression: { type: 'COURSE', courseId: from },
});
const base = (): RecommendationContext => ({
  curriculum: { id: 'chart', name: 'چارت آزمایشی' } as any,
  curriculumCourses: courses.map(({ id }) => ({
    id: 'cc-' + id, curriculumId: 'chart', courseId: id,
    classification: 'MAJOR_REQUIRED', active: true,
  })) as any,
  allCourses: courses,
  academicRules: [rule('a','b'), rule('b','c'), rule('c','d'), rule('x','y')],
  eligibilityResults: [evaluation('a'), evaluation('x')],
});

describe('graduation-wide academic recommendation is deeper than next-term ranking', () => {
  it('ranks a long multi-year chain above an isolated next-course dependency', () => {
    const result = generateCourseRecommendations(base());
    expect(result[0].courseId).toBe('a');
    expect(result[0].unlockedFutureCoursesCount).toBe(3);
    expect(result[0].unlockedCourseNames).toEqual(['درس B','درس C','درس D']);
    expect(result[0].reasons.join(' ')).toContain('تا انتهای دوره');
    expect(result[0].reasons.join(' ')).toContain('عمق ۳');
    expect(result[0].score).toBeGreaterThan(result[1].score);
    expect(result[1].unlockedFutureCoursesCount).toBe(1);
  });

  it('does not count a genuine pass as unfinished study, while retaining indirect connections', () => {
    const context = base();
    context.completedCourseIds = ['b', 'c'];
    const result = generateCourseRecommendations(context);
    const a = result.find(item => item.courseId === 'a')!;
    expect(a.unlockedFutureCoursesCount).toBe(1);
    expect(a.unlockedCourseNames).toEqual(['درس D']);
    expect(a.reasons.join(' ')).toContain('عمق ۳');
  });

  it('deduplicates diamond-shaped paths and excludes corequisites from prerequisite score', () => {
    const context = base();
    context.academicRules = [rule('a','b'),rule('a','c'),rule('b','d'),rule('c','d'), {
      ...rule('a','y'), relationshipType: 'COREQUISITE',
    }];
    const result = generateCourseRecommendations(context).find(item => item.courseId === 'a')!;
    expect(result.unlockedFutureCoursesCount).toBe(3);
    expect(result.unlockedCourseNames.sort()).toEqual(['درس B','درس C','درس D']);
  });

  it('states an OR path is only a possible route, not a mandatory future course', () => {
    const context = base();
    context.academicRules = [{
      id:'choice', curriculumId:'chart', targetCourseId:'b', relationshipType:'PREREQUISITE',
      expression: { type:'GROUP', operator:'OR', operands:[
        { type:'COURSE',courseId:'a' },{ type:'COURSE',courseId:'x' },
      ] },
    },rule('b','c')];
    const a = generateCourseRecommendations(context).find(item=>item.courseId==='a')!;
    expect(a.unlockedFutureCoursesCount).toBe(2);
    expect(a.reasons.join(' ')).toContain('شرط «یا»');
    expect(a.reasons.join(' ')).not.toContain('مجاز قطعی');
  });

  it('refuses to publish invented downstream importance for cyclic charts', () => {
    const context = base();
    context.academicRules = [rule('a','b'),rule('b','a')];
    const a = generateCourseRecommendations(context).find(item=>item.courseId==='a')!;
    expect(a.unlockedFutureCoursesCount).toBe(0);
    expect(a.reasons.join(' ')).toContain('ناسازگاری قواعد چارت');
  });

  it('does not include a future relation from a different curriculum or inactive assignment', () => {
    const context = base();
    context.curriculumCourses = context.curriculumCourses.map(row=>
      row.courseId==='b' ? {...row,active:false} : row);
    // A missing chart member makes the graph invalid; never infer importance.
    const a = generateCourseRecommendations(context).find(item=>item.courseId==='a')!;
    expect(a.unlockedFutureCoursesCount).toBe(0);
    expect(a.reasons.join(' ')).toContain('ناسازگاری قواعد چارت');
  });
});
