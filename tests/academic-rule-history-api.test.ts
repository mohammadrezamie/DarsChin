import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { curriculumRouter } from '../server/routes/curriculum';
import { generateToken } from '../server/middleware/auth';

const chartId='synthetic-revisioned-history-chart';
const adminId='synthetic-prerequisite-admin';
const studentId='synthetic-prerequisite-student';
const app=express();
app.use(express.json());
app.use('/api/curriculum',curriculumRouter);
let rootToken='',adminToken='',studentToken='';
let original: {curricula:typeof db.data.curricula; curriculumCourses:typeof db.data.curriculumCourses;
  academicRules:typeof db.data.academicRules; auditLogs:typeof db.data.auditLogs; users:typeof db.data.users} | null=null;
let saveSpy:ReturnType<typeof vi.spyOn> | null=null;
const bearer=(token:string)=>({Authorization:'Bearer '+token});

beforeAll(async()=>{
  await db.init(true);
  original={
    curricula:db.data.curricula,curriculumCourses:db.data.curriculumCourses,
    academicRules:db.data.academicRules,auditLogs:db.data.auditLogs,users:db.data.users,
  };
  saveSpy=vi.spyOn(db,'save').mockImplementation(()=>undefined);
  const root=db.users.find(u=>u.roles.includes('super-admin'));
  if(!root)throw Error('No isolated root account');
  rootToken=generateToken({id:root.id});
  db.users.push({
    id:adminId,name:'Synthetic Rules Manager',mobile:'09900000113',password:'test',
    roles:['student','admin'],permissions:['prerequisite.manage'],createdAt:new Date().toISOString(),
  });
  db.users.push({
    id:studentId,name:'Synthetic Student',mobile:'09900000114',password:'test',
    roles:['student'],permissions:['prerequisite.manage'],createdAt:new Date().toISOString(),
  });
  adminToken=generateToken({id:adminId});studentToken=generateToken({id:studentId});
  db.curricula.push({
    id:chartId,name:'Synthetic history chart',status:'active',
    majorId:'synthetic-major',entryYearId:'synthetic-entry',
  } as any);
  for(const courseId of ['a','b','c'])db.curriculumCourses.push({
    id:'cc-'+chartId+'-'+courseId,curriculumId:chartId,courseId,active:true,
    classification:'MAJOR_REQUIRED',
  } as any);
});
beforeEach(()=>{
  db.data.academicRules = db.academicRules.filter(r=>r.curriculumId!==chartId);
  db.data.auditLogs = db.auditLogs.filter(l=>!(l.entityType==='AcademicRule' && l.details?.includes(chartId)));
});
afterAll(()=>{
  if(original){
    db.data.curricula=original.curricula;
    db.data.curriculumCourses=original.curriculumCourses;
    db.data.academicRules=original.academicRules;
    db.data.auditLogs=original.auditLogs;
    db.data.users=original.users;
  }
  saveSpy?.mockRestore();
});
const rule=(from:string,to:string)=>({
  curriculumId:chartId,targetCourseId:to,relationshipType:'PREREQUISITE',
  expression:{type:'COURSE',courseId:from},
});
const snapshot=async(token:string)=>request(app).get('/api/curriculum/rules/history/'+chartId).set(bearer(token));

describe('real HTTP rules history: auth, revisions and safe undo/redo',()=>{
  it('does not expose admin history to unauthenticated users or a student carrying stale permission',async()=>{
    expect((await request(app).get('/api/curriculum/rules/history/'+chartId)).status).toBe(401);
    expect((await snapshot(studentToken)).status).toBe(403);
    expect((await request(app).post('/api/curriculum/rules/history/'+chartId+'/revert')
      .set(bearer(studentToken)).send({eventId:'fake',expectedRevision:'0'.repeat(64)})).status).toBe(403);
  });

  it('does not let a stale admin overwrite newer changes, and records an actionable journal entry',async()=>{
    const initial=(await snapshot(adminToken)).body.data;
    expect(initial.revision).toMatch(/^[a-f0-9]{64}$/);
    const create=await request(app).post('/api/curriculum/rules')
      .set(bearer(adminToken)).set('If-Match',initial.revision).send(rule('a','b'));
    expect(create.status).toBe(200);
    expect(create.body.revision).not.toBe(initial.revision);
    const stale=await request(app).post('/api/curriculum/rules')
      .set(bearer(adminToken)).set('If-Match',initial.revision).send(rule('b','c'));
    expect(stale.status).toBe(409);
    expect(db.academicRules.filter(r=>r.curriculumId===chartId)).toHaveLength(1);
    const history=(await snapshot(adminToken)).body.data;
    expect(history.entries).toHaveLength(1);
    expect(history.entries[0].canRevert).toBe(true);
    expect(history.entries[0].ruleId).toBe(create.body.data.id);
    expect(history.revision).toBe(create.body.revision);
    const other=(await snapshot(rootToken)).body.data.entries[0];
    expect(other.canRevert).toBe(true);
  });

  it('reverts a persisted ADD, then redoes it safely with a second audited change',async()=>{
    const start=(await snapshot(adminToken)).body.data.revision;
    const created=await request(app).post('/api/curriculum/rules')
      .set(bearer(adminToken)).set('If-Match',start).send(rule('a','b'));
    expect(created.status).toBe(200);
    const hist=(await snapshot(adminToken)).body.data;
    const undo=await request(app).post('/api/curriculum/rules/history/'+chartId+'/revert')
      .set(bearer(adminToken)).send({eventId:hist.entries[0].id,expectedRevision:hist.revision});
    expect(undo.status).toBe(200);
    expect(db.academicRules.filter(r=>r.curriculumId===chartId)).toHaveLength(0);
    expect(undo.body.data.revision).toBe(start);
    const previous=await request(app).post('/api/curriculum/rules/history/'+chartId+'/revert')
      .set(bearer(adminToken)).send({eventId:hist.entries[0].id,expectedRevision:hist.revision});
    expect(previous.status).toBe(409);
    const newHistory=(await snapshot(adminToken)).body.data;
    expect(newHistory.entries[0].revertedEventId).toBe(hist.entries[0].id);
    const redo=await request(app).post('/api/curriculum/rules/history/'+chartId+'/revert')
      .set(bearer(adminToken)).send({eventId:newHistory.entries[0].id,expectedRevision:newHistory.revision});
    expect(redo.status).toBe(200);
    expect(db.academicRules.filter(r=>r.curriculumId===chartId)).toHaveLength(1);
    expect(db.academicRules.find(r=>r.curriculumId===chartId)?.id).toBe(created.body.data.id);
  });

  it('supports restoring a deleted rule, but not undoing after another writer changes that chart',async()=>{
    const start=(await snapshot(adminToken)).body.data.revision;
    const created=await request(app).post('/api/curriculum/rules')
      .set(bearer(adminToken)).set('If-Match',start).send(rule('a','b'));
    const afterCreate=(await snapshot(adminToken)).body.data.revision;
    const deleted=await request(app).delete('/api/curriculum/rules/'+created.body.data.id)
      .set(bearer(adminToken)).set('If-Match',afterCreate);
    expect(deleted.status).toBe(200);
    const history=(await snapshot(adminToken)).body.data;
    const restored=await request(app).post('/api/curriculum/rules/history/'+chartId+'/revert')
      .set(bearer(adminToken)).send({eventId:history.entries[0].id,expectedRevision:history.revision});
    expect(restored.status).toBe(200);
    expect(db.academicRules.find(r=>r.id===created.body.data.id)).toBeDefined();
    const latest=(await snapshot(adminToken)).body.data;
    const other=await request(app).post('/api/curriculum/rules')
      .set(bearer(rootToken)).set('If-Match',latest.revision).send(rule('b','c'));
    expect(other.status).toBe(200);
    const conflict=await request(app).post('/api/curriculum/rules/history/'+chartId+'/revert')
      .set(bearer(adminToken)).send({eventId:latest.entries[0].id,expectedRevision:latest.revision});
    expect(conflict.status).toBe(409);
  });
});
