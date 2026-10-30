import { describe, expect, it } from 'vitest';
import { generateCourseRecommendations } from '../src/domain/recommendation-engine';
import type { RecommendationContext } from '../src/domain/recommendation-engine';

const base=():RecommendationContext=>({
  curriculum:{id:'chart',name:'Synthetic chart'} as any,
  curriculumCourses:[{id:'cc1',curriculumId:'chart',courseId:'course-1',
    classification:'MAJOR_REQUIRED',suggestedSemester:3,active:true} as any],
  allCourses:[{id:'course-1',code:'EXAMPLE',name:'Synthetic course',units:3,
    active:true,category:'تخصصی'}],
  academicRules:[],
  eligibilityResults:[{offeringId:'group-1',courseId:'course-1',courseCode:'EXAMPLE',
    courseName:'Synthetic course',units:3,category:'تخصصی',groupCode:'01',
    instructor:'Teacher',dayOfWeek:'شنبه',startTime:'08:00',endTime:'10:00',
    capacity:20,enrolledCount:0,overallStatus:'AVAILABLE',canSelect:true,isEligible:true,
    primaryReason:'',allReasons:[],missingPrerequisites:[],missingCorequisites:[]}],
});

describe('recommendations do not pretend every student is in semester three',()=>{
  it('omits personalized semester points and reasons when the academic standing is unknown',()=>{
    const unknown=generateCourseRecommendations(base())[0];
    expect(unknown.score).toBe(65);
    expect(unknown.reasons.join(' ')).not.toContain('متناسب با ترم');
    const explicit=generateCourseRecommendations({...base(),approximateStudentSemester:3})[0];
    expect(explicit.score).toBe(80);
    expect(explicit.reasons.join(' ')).toContain('مطابق ترم');
  });

  it('does not score downstream rules from another entry year or track as this student\'s future courses',()=>{
    const context=base();
    context.curriculumCourses.push({id:'cc2',curriculumId:'chart',
      courseId:'course-2',classification:'MAJOR_REQUIRED',active:true} as any);
    context.allCourses.push({id:'course-2',code:'NEXT',name:'Next synthetic course',
      units:3,category:'تخصصی',active:true});
    context.studentProfile={
      majorId:'m1',entryYearId:'1405',isTrackSelected:true,
      selectedTrackId:'track-a',desiredTrackIds:[],
    };
    const rule=(entryYearId:string,trackId:string)=>({
      id:'synthetic-'+entryYearId+'-'+trackId,
      curriculumId:'chart',targetCourseId:'course-2',relationshipType:'PREREQUISITE' as const,
      expression:{type:'COURSE' as const,courseId:'course-1'},entryYearId,trackId,
    });
    context.academicRules=[rule('1404','track-a'),rule('1405','track-b')];
    const foreign=generateCourseRecommendations(context)[0];
    expect(foreign.unlockedFutureCoursesCount).toBe(0);
    expect(foreign.score).toBe(65);
    context.academicRules=[...context.academicRules,rule('1405','track-a')];
    const matching=generateCourseRecommendations(context)[0];
    expect(matching.unlockedFutureCoursesCount).toBe(1);
    expect(matching.score).toBe(80);
  });

});
