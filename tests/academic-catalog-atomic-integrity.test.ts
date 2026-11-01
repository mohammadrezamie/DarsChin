import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db, type DatabaseSchema } from '../server/db/database';
import { academicRouter } from '../server/routes/academic';
import { generateToken } from '../server/middleware/auth';
import type { AcademicRule, Course, StudentAcademicProfile } from '../src/types';

const app = express();
app.use(express.json());
app.use('/api/academic', academicRouter);
const sensitive = 'SYNTHETIC_PRIVATE_PATH:/operator/secrets/.env';
let previous: DatabaseSchema;
let rootAuth: string;
const prefix = '/api/academic';

beforeAll(async () => { await db.init(true); });
beforeEach(() => {
  previous = db.data;
  const root = previous.users.find(u => u.id === 'usr-super');
  if (!root) throw Error('Expected synthetic test root fixture');
  rootAuth = 'Bearer ' + generateToken(root);
  const cloned = Object.fromEntries([
    'provinces','universities','campuses','degreeLevels','majors','tracks','entryYears',
    'academicTerms','courses','curricula','studentProfiles','academicRules','courseOfferings',
    'curriculumCourses','demandSurveys','studentPassedCourses','importRecords'
  ].map(key => [key, structuredClone((previous as unknown as Record<string, unknown>)[key])]));
  db.data = { ...previous, ...cloned };
});
afterEach(() => { vi.restoreAllMocks(); db.data = previous; });

const post = (path:string,payload:unknown) =>
  request(app).post(prefix+path).set('Authorization',rootAuth).send(payload);
const put = (path:string,payload:unknown) =>
  request(app).put(prefix+path).set('Authorization',rootAuth).send(payload);
const remove = (path:string) => request(app).delete(prefix+path).set('Authorization',rootAuth);
const failSave = () => vi.spyOn(db,'save').mockImplementationOnce(() => { throw Error(sensitive); });
const notLeaked = (response:{status:number;body:unknown}) => {
  expect(response.status).toBe(503);
  expect(JSON.stringify(response.body)).not.toContain(sensitive);
};
const syntheticCourse = (id:string): Course => ({
  id, code:'SYNTHETIC-CAT-'+id, name:'درس آزمایشی مستقل',units:2,
  category:'تخصصی',active:true,
});

describe('academic catalogue validation and irreversible reference protection', () => {
  it('rejects missing or invalid degree, year, term and course payloads before mutation',async()=>{
    const before={
      degrees:db.degreeLevels.length,years:db.entryYears.length,
      terms:db.academicTerms.length,courses:db.courses.length,
    };
    const bad=[
      await post('/degrees',{name:{text:'bad'},code:'NO'}),
      await post('/entry-years',{year:'NaN'}),
      await post('/entry-years',{year:1403}),
      await post('/terms',{name:'fake',year:2088,termNumber:9,isCurrent:true}),
      await post('/courses',{name:'X',code:'NEW-INVALID',units:'NaN',category:'تخصصی'}),
      await post('/courses',{name:'X',code:'NEW-INVALID',units:2,practicalUnits:4,category:'تخصصی'}),
      await post('/courses',{name:'X',code:'NEW-INVALID',units:2,category:'INCORRECT'}),
    ];
    for(const response of bad) expect([400,409]).toContain(response.status);
    expect({degrees:db.degreeLevels.length,years:db.entryYears.length,
      terms:db.academicTerms.length,courses:db.courses.length}).toEqual(before);
  });

  it('creates an extra-unit course only after explicit valid input and detects code duplication',async()=>{
    const response=await post('/courses',{name:'درس جدید آزمایشی',code:'SYN-UNIQUE-101',
      units:2,practicalUnits:0,category:'عمومی',isExtraUnit:true});
    expect(response.status).toBe(200);
    expect(response.body.data.isExtraUnit).toBe(true);
    const duplicated=await post('/courses',{name:'درس دوم',code:'syn-unique-101',
      units:2,category:'عمومی'});
    expect(duplicated.status).toBe(409);
    const edited=await put('/courses/'+response.body.data.id,{units:3,isExtraUnit:false});
    expect(edited.status).toBe(200);
    expect(edited.body.data.isExtraUnit).toBe(false);
    expect(edited.body.data.units).toBe(3);
  });

  it('rolls back course creation and updates, including the extra-unit academic flag',async()=>{
    const course=syntheticCourse('rollback');
    db.courses.push(course);
    const snapshot=JSON.stringify(db.courses);
    let spy=failSave();
    const create=await post('/courses',{name:'درس آزمایشی',code:'SYNTH-ROLLBACK-NEW',
      units:2,category:'تخصصی'});
    spy.mockRestore();notLeaked(create);
    expect(JSON.stringify(db.courses)).toBe(snapshot);
    spy=failSave();
    const update=await put('/courses/'+course.id,{units:7,isExtraUnit:true});
    spy.mockRestore();notLeaked(update);
    expect(JSON.stringify(db.courses)).toBe(snapshot);
  });

  it('never deletes a course used as a nested prerequisite source',async()=>{
    const source=syntheticCourse('source-dependency');
    db.courses.push(source);
    const chart=db.curricula.find(c=>c.status==='active');
    const target=db.courses.find(c=>c.active && c.id!==source.id);
    if(!chart||!target)throw Error('Missing synthetic chart/target');
    const rule:AcademicRule={
      id:'synthetic-nested-rule',curriculumId:chart.id,targetCourseId:target.id,
      relationshipType:'PREREQUISITE',expression:{
        type:'GROUP',operator:'OR',operands:[
          {type:'GROUP',operator:'AND',operands:[{type:'COURSE',courseId:source.id}]},
          {type:'COURSE',courseId:target.id},
        ]
      },
    };
    db.academicRules.push(rule);
    const response=await remove('/courses/'+source.id);
    expect(response.status).toBe(409);
    expect(db.courses.some(c=>c.id===source.id)).toBe(true);
  });

  it('soft-deactivates a referenced campus without destroying student or chart references',async()=>{
    const base=db.campuses[0];
    const chart=db.curricula.find(c=>c.status==='active');
    if(!base || !chart)throw Error('Missing campus and chart');
    const campus={...base,id:'synthetic-referenced-campus',code:'SYN-REFERENCED',active:true};
    db.campuses.push(campus);
    const profile:StudentAcademicProfile={
      userId:'synthetic-referenced-student',universityId:campus.universityId,campusId:campus.id,
      degreeLevelId:chart.degreeLevelId,majorId:chart.majorId,entryYearId:chart.entryYearId,
      isTrackSelected:false,desiredTrackIds:[],updatedAt:new Date().toISOString(),
    };
    db.studentProfiles.push(profile);
    db.curricula.push({...chart,id:'synthetic-reference-curriculum',campusId:campus.id});
    const edited=await put('/campuses/'+campus.id,{universityId:
      db.universities.find(u=>u.id!==campus.universityId)?.id||'synthetic-nonexistent'});
    expect([400,409]).toContain(edited.status);
    expect(db.campuses.find(c=>c.id===campus.id)?.universityId).toBe(campus.universityId);
    const response=await remove('/campuses/'+campus.id);
    expect(response.status).toBe(200);
    expect(db.campuses.find(c=>c.id===campus.id)?.active).toBe(false);
    expect(db.curricula.some(c=>c.campusId===campus.id)).toBe(true);
    expect(db.studentProfiles.some(p=>p.campusId===campus.id)).toBe(true);
  });

  it('rolls back changing the current term when persistence fails',async()=>{
    const snapshot=JSON.stringify(db.academicTerms);
    const spy=failSave();
    const failed=await post('/terms',{name:'ترم آزمایشی',year:2088,termNumber:1,isCurrent:true});
    spy.mockRestore();notLeaked(failed);
    expect(JSON.stringify(db.academicTerms)).toBe(snapshot);
    const committed=await post('/terms',{name:'ترم آزمایشی',year:2088,termNumber:1,isCurrent:true});
    expect(committed.status).toBe(200);
    expect(db.academicTerms.filter(t=>t.isCurrent)).toHaveLength(1);
    expect((await post('/terms',{name:'تکراری',year:2088,termNumber:1})).status).toBe(409);
  });

  it('does not delete a requested track stored in a student preference list',async()=>{
    const major=db.majors[0];
    const track={id:'synthetic-desired-track',majorId:major.id,
      name:'گرایش آزمایشی',code:'SYN-TRACK',active:true};
    db.tracks.push(track);
    db.studentProfiles.push({
      userId:'synthetic-track-preference',universityId:'synthetic-u',campusId:'synthetic-c',
      degreeLevelId:major.degreeLevelId,majorId:major.id,entryYearId:'synthetic-year',
      isTrackSelected:false,desiredTrackIds:[track.id],updatedAt:new Date().toISOString(),
    });
    expect((await remove('/tracks/'+track.id)).status).toBe(409);
    expect(db.tracks.some(t=>t.id===track.id)).toBe(true);
  });
});
