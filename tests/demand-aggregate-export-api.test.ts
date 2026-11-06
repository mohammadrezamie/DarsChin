import {beforeAll,beforeEach,afterEach,describe,expect,it} from 'vitest';
import express from 'express';
import request from 'supertest';
import {db,type DatabaseSchema} from '../server/db/database';
import {demandRouter} from '../server/routes/demand';
import {generateToken} from '../server/middleware/auth';
import type {DemandSurvey,DemandResponse,User} from '../src/types';

const app=express();app.use(express.json());app.use('/api/demand',demandRouter);
let original:DatabaseSchema,auth='',foreignAuth='',surveyId='test-summary-only-scope';
let courseId='';
beforeAll(async()=>{await db.init(true);});
beforeEach(()=>{
  original=db.data;db.data=structuredClone(original);
  const c=db.courses.find(course=>course.active)!;
  const campus=db.campuses.find(item=>item.active)!;
  const major=db.majors.find(item=>item.active)!;
  const year=db.entryYears.find(item=>item.active)!;
  if(!c||!campus||!major||!year)throw Error('Missing synthetic fixtures');
  courseId=c.id;
  const now=new Date().toISOString();
  const chart=db.curricula.find(item=>item.campusId===campus.id&&item.majorId===major.id&&item.entryYearId===year.id);
  const survey:DemandSurvey={
    id:surveyId,title:'نیازسنجی فقط آمار',description:'',targetTermId:'t',
    universityId:campus.universityId,campusId:campus.id,degreeLevelId:major.degreeLevelId,
    majorId:major.id,curriculumId:chart?.id,entryYearIds:[year.id],trackIds:[],
    courseIds:[courseId],recommendedMinimumByCourse:{[courseId]:2},status:'OPEN',
    createdBy:'summary-manager',createdAt:now,updatedAt:now,
  };
  const answer:DemandResponse={
    id:'summary-answer',surveyId,userId:'summary-student',studentNumber:'4010027416',
    anticipatedGraduation:'YES',courseIds:[courseId],submittedAt:now,updatedAt:now,
    snapshot:{studentName:'نام محرمانه برای آزمایش',campusId:campus.id,majorId:major.id,
      entryYearId:year.id,isTrackSelected:false},
  };
  db.demandSurveys.push(survey);db.demandResponses.push(answer);
  const owner:User={id:'summary-manager',mobile:'09950007301',name:'مدیر محدود',
    roles:['admin'],permissions:['demand.manage'],
    demandScopes:[{campusId:campus.id,degreeLevelId:major.degreeLevelId,majorId:major.id}],
    createdAt:now};
  const outsider:User={...owner,id:'summary-outsider',mobile:'09950007302',
    demandScopes:[{campusId:'other-campus',degreeLevelId:major.degreeLevelId,majorId:major.id}]};
  db.users.push(owner,outsider);
  auth='Bearer '+generateToken(owner);foreignAuth='Bearer '+generateToken(outsider);
});
afterEach(()=>{db.data=original;});
describe('صادرات جمع‌آوری تقاضا فقط با دسترسی مدیریتی همان حوزه',()=>{
  it('مدیر دارای مجوز گزارش تجمیعی را بدون مشخصات افراد دریافت می‌کند',async()=>{
    const r=await request(app).get('/api/demand/surveys/'+surveyId+'/summary.csv?format=json')
      .set('Authorization',auth);
    expect(r.status).toBe(200);
    const csv=r.body.data.csv as string;
    expect(csv).toContain('تعداد تقاضا');
    expect(csv).toContain('حدنصاب');
    expect(csv).toContain('1');
    expect(csv).not.toContain('4010027416');
    expect(csv).not.toContain('نام محرمانه');
    expect(csv).not.toContain('summary-student');
  });
  it('کاربر بدون مجوز حوزه یا هویت معتبر آمار را دریافت نمی‌کند',async()=>{
    expect((await request(app).get('/api/demand/surveys/'+surveyId+'/summary.csv')
      .set('Authorization',foreignAuth)).status).toBe(403);
    expect((await request(app).get('/api/demand/surveys/'+surveyId+'/summary.csv')).status).toBe(401);
    expect((await request(app).get('/api/demand/surveys/'+surveyId+'/export.csv?format=json')
      .set('Authorization',auth)).status).toBe(403);
  });
});
