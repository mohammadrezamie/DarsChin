import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { studentRouter } from '../server/routes/student';
import { generateToken } from '../server/middleware/auth';

const id='synthetic-graduation-wishlist-student';
const chartId='synthetic-graduation-wishlist-chart';
const app=express();
app.use(express.json());
app.use('/api/student',studentRouter);
let token='';
let saveSpy:ReturnType<typeof vi.spyOn>;
let prior: typeof db.data;
const bearer=()=>({Authorization:'Bearer '+token});
const course=(id:string)=>({id,code:id.toUpperCase(),name:'درس '+id,units:3,category:'تخصصی',active:true});
const rule=(from:string,to:string)=>({
  id:'synthetic-rule-'+from+'-'+to,curriculumId:chartId,
  targetCourseId:to,relationshipType:'PREREQUISITE',
  expression:{type:'COURSE',courseId:from},
});

beforeAll(async()=>{
  await db.init(true);
  prior={
    ...db.data,
    users:[...db.data.users], studentProfiles:[...db.data.studentProfiles],
    courses:[...db.data.courses],curricula:[...db.data.curricula],
    curriculumCourses:[...db.data.curriculumCourses],academicRules:[...db.data.academicRules],
    studentPassedCourses:[...db.data.studentPassedCourses],
  };
  saveSpy=vi.spyOn(db,'save').mockImplementation(()=>undefined);
  db.users.push({
    id,name:'Synthetic Graduate Student',mobile:'09900000222',password:'unimportant',
    roles:['student'],permissions:[],createdAt:new Date().toISOString(),
  });
  token=generateToken({id});
  db.studentProfiles.push({
    userId:id,universityId:'university-x',campusId:'campus-x',degreeLevelId:'bsc',
    majorId:'ee',entryYearId:'1403',isTrackSelected:true,selectedTrackId:null,
    desiredTrackIds:[],studentNumber:'synthetic-only',
  } as any);
  db.curricula.push({
    id:chartId,name:'Synthetic graduation chart',status:'active',
    universityId:'university-x',campusId:'campus-x',degreeLevelId:'bsc',
    majorId:'ee',entryYearId:'1403',
  } as any);
  for(const courseId of ['a','b','c','d','e','x']) {
    db.courses.push(course(courseId) as any);
    db.curriculumCourses.push({
      id:'cc-'+chartId+'-'+courseId,curriculumId:chartId,courseId,
      classification:'MAJOR_REQUIRED',active:true,suggestedSemester:2,
    } as any);
  }
  db.academicRules.push(...[rule('a','b'),rule('b','c'),rule('c','d')] as any);
  db.academicRules.push({
    id:'synthetic-OR',curriculumId:chartId,relationshipType:'PREREQUISITE',
    targetCourseId:'e',expression:{type:'GROUP',operator:'OR',operands:[
      {type:'COURSE',courseId:'a'},{type:'COURSE',courseId:'x'},
    ]},
  } as any);
  for(const courseId of ['b','c'])db.studentPassedCourses.push({
    id:'pass-'+courseId,userId:id,courseId,status:'PASSED',grade:17,
  } as any);
  db.studentPassedCourses.push({
    id:'fail-e',userId:id,courseId:'e',status:'FAILED',grade:5,
  } as any);
});
afterAll(()=>{if(prior)db.data=prior;saveSpy?.mockRestore();});

describe('student wishlist covers the entire remaining graduation chart',()=>{
  it('requires authentication and never leaks academic records to outsiders',async()=>{
    expect((await request(app).get('/api/student/wishlist/catalog')).status).toBe(401);
  });
  it('ranks completed-filtered paths even without any offering in the current semester',async()=>{
    const response=await request(app).get('/api/student/wishlist/catalog').set(bearer());
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    const rows=response.body.data;
    const byId=new Map<string,any>(rows.map((row:any)=>[row.id,row]));
    expect(rows).toHaveLength(4);
    expect(byId.has('b')).toBe(false);
    expect(byId.has('c')).toBe(false);
    expect(byId.has('e')).toBe(true); // failed course, not counted as passed
    const a=byId.get('a');
    expect(a.graduationAnalysisValid).toBe(true);
    expect(a.noChoiceFutureCoursesCount).toBe(1); // d, through already-passed b & c
    expect(a.choiceOnlyFutureCoursesCount).toBe(1); // e, optional OR branch
    expect(a.longestRemainingPrerequisiteChain).toBe(1);
    expect(rows[0].id).toBe('a');
  });
  it('does not invent priority when the scoped graph becomes cyclic',async()=>{
    const cyclic={
      id:'synthetic-cycle',curriculumId:chartId,targetCourseId:'a',
      relationshipType:'PREREQUISITE',expression:{type:'COURSE',courseId:'d'},
    } as any;
    db.academicRules.push(cyclic);
    try{
      const response=await request(app).get('/api/student/wishlist/catalog').set(bearer());
      expect(response.status).toBe(200);
      const a=response.body.data.find((row:any)=>row.id==='a');
      expect(a.graduationAnalysisValid).toBe(false);
      expect(a.noChoiceFutureCoursesCount).toBeUndefined();
    }finally{db.data.academicRules=db.academicRules.filter(rule=>rule.id!==cyclic.id)}
  });
});
