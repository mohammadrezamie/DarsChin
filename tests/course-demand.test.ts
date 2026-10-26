import { describe, expect, it } from 'vitest';
import {
  downstreamCourseIds, managerCanAccessDemand, surveyAppliesToProfile,
  summarizeDemand, exportDemandCsv,
} from '../src/domain/course-demand';
import type {
  AcademicRule, DemandResponse, DemandSurvey, StudentAcademicProfile, User,
} from '../src/types';

const survey: DemandSurvey = {
  id:'s-1',title:'نیازسنجی مهندسی برق',description:'',
  targetTermId:'term-next',universityId:'univ',campusId:'srb',
  degreeLevelId:'be',majorId:'ee',curriculumId:'ee-1403',
  entryYearIds:['year-1403'],trackIds:[],courseIds:['a','b','c'],
  recommendedMinimumByCourse:{a:2,b:1,c:0},
  status:'OPEN',createdBy:'manager',createdAt:'2026-10-25T00:00:00Z',updatedAt:'2026-10-25T00:00:00Z',
};
const profile: StudentAcademicProfile = {
  userId:'student',universityId:'univ',campusId:'srb',degreeLevelId:'be',
  majorId:'ee',entryYearId:'year-1403',isTrackSelected:false,desiredTrackIds:[],
  updatedAt:'2026-10-25T00:00:00Z',
};
const response = (userId:string,courses:string[],graduation:'YES'|'NO'|'UNKNOWN'='UNKNOWN'):DemandResponse=>({
  id:userId,surveyId:survey.id,userId,studentNumber:'1403123456',
  anticipatedGraduation:graduation,courseIds:courses,
  snapshot:{studentName:userId,campusId:'srb',majorId:'ee',
    entryYearId:'year-1403',isTrackSelected:false},
  submittedAt:'2026-10-25T00:00:00Z',updatedAt:'2026-10-25T00:00:00Z',
});
const manager = (permissions:string[],campusId='srb'):User=>({
  id:'manager',mobile:'09120000000',name:'مدیر نمونه',roles:['admin'],permissions,
  demandScopes:[{campusId,degreeLevelId:'be',majorId:'ee'}],
  createdAt:'2026-10-25T00:00:00Z',
});

describe('course demand domain boundaries',()=>{
  it('applies exact campus, degree, major, entry cohort and selected track scope',()=>{
    expect(surveyAppliesToProfile(survey,profile)).toBe(true);
    expect(surveyAppliesToProfile(survey,{...profile,campusId:'other'})).toBe(false);
    expect(surveyAppliesToProfile(survey,{...profile,entryYearId:'other'})).toBe(false);
    expect(surveyAppliesToProfile({...survey,trackIds:['control']},profile)).toBe(false);
    expect(surveyAppliesToProfile({...survey,trackIds:['control']},{...profile,isTrackSelected:true,selectedTrackId:'control'})).toBe(true);
  });
  it('never treats generic admin access as department authority or PII export permission',()=>{
    expect(managerCanAccessDemand(manager(['admin.panel.access']),survey)).toBe(false);
    expect(managerCanAccessDemand(manager(['demand.manage'],'other'),survey)).toBe(false);
    expect(managerCanAccessDemand(manager(['demand.manage']),survey)).toBe(true);
    expect(managerCanAccessDemand(manager(['demand.manage']),survey,true)).toBe(false);
    expect(managerCanAccessDemand(manager(['demand.export']),survey,true)).toBe(true);
    expect(managerCanAccessDemand({...manager(['demand.manage','demand.export']),roles:['student']},survey)).toBe(false);
    expect(managerCanAccessDemand({...manager(['demand.manage','demand.export']),roles:['student']},survey,true)).toBe(false);
  });
  it('counts distinct response records and labels threshold as suggested, not a scheduled class',()=>{
    const result=summarizeDemand(survey,[response('u1',['a','b'],'YES'),response('u2',['a'],'NO')]);
    expect(result.participantCount).toBe(2);
    expect(result.byCourse.find(x=>x.courseId==='a')).toMatchObject({
      count:2,threshold:2,meetsSuggestedThreshold:true,selfReportedFinalSemester:1,
    });
    expect(result.byCourse.find(x=>x.courseId==='b')?.count).toBe(1);
    expect(result.byCourse.find(x=>x.courseId==='c')?.meetsSuggestedThreshold).toBe(false);
  });
  it('escapes spreadsheet formulas and includes student identifier only inside manager export',()=>{
    const malicious={...response('x',['a']),snapshot:{...response('x',['a']).snapshot,studentName:'=HYPERLINK("bad")'}};
    const csv=exportDemandCsv(survey,[malicious],new Map([['a','مدارهای الکتریکی']]),
      new Map([['year-1403','۱۴۰۳']]),new Map());
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"\'=HYPERLINK(""bad"")"');
    expect(csv).toContain('1403123456');
    expect(csv).toContain('مدارهای الکتریکی');
  });
  it('includes every participating student in the identity export, even with zero requested courses',()=>{
    const empty = response('zero',['a']);
    empty.courseIds = [];
    empty.snapshot.studentName = 'شرکت‌کننده بدون انتخاب';
    const chosen = response('one',['a']);
    const aggregate = summarizeDemand(survey,[empty,chosen]);
    const csv = exportDemandCsv(survey,[empty,chosen],new Map([['a','ریاضی']]),
      new Map([['year-1403','۱۴۰۳']]),new Map());
    const rows = csv.slice(1).trimEnd().split('\\r\\n');
    expect(aggregate.participantCount).toBe(2);
    expect(rows).toHaveLength(3); // one header and one row for each participant
    expect(csv).toContain('شرکت‌کننده بدون انتخاب');
    expect(csv).toContain('"بدون درس درخواستی",""');
    expect(csv).toContain('"ریاضی","a"');
  });

  it('guards leading invisible formula prefixes and prevents embedded control characters creating CSV rows',()=>{
    const payload = response('x',['a']);
    payload.snapshot.studentName = '\\u200b=HYPERLINK("https://example.invalid")\\r\\nنام';
    payload.studentNumber = '\\t@SUM(1,2)';
    const csv = exportDemandCsv(survey,[payload],new Map([['a','مدار']]),
      new Map([['year-1403','۱۴۰۳']]),new Map());
    const rows = csv.slice(1).trimEnd().split('\\r\\n');
    expect(rows).toHaveLength(2);
    expect(csv).toContain('"\'\\u200b=HYPERLINK(""https://example.invalid"")');
    expect(csv).toContain('"\' @SUM(1,2)"');
    expect(csv).not.toContain('\\r\\nنام');
  });
  it('counts multi-step prerequisite dependencies without cycles or other curricula',()=>{
    const rule=(id:string,target:string,source:string,curriculumId='ee-1403'):AcademicRule=>({
      id,curriculumId,targetCourseId:target,relationshipType:'PREREQUISITE',
      expression:{type:'COURSE',courseId:source},
    });
    const links=[rule('r1','b','a'),rule('r2','c','b'),rule('r3','d','c'),
      rule('r4','x','a','other-curriculum'),rule('r5','a','d')];
    expect(downstreamCourseIds('a','ee-1403',links).sort()).toEqual(['b','c','d']);
    expect(downstreamCourseIds('a','other-curriculum',links)).toEqual(['x']);
  });
});
