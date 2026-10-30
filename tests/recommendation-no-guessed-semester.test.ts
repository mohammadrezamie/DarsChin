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
});
