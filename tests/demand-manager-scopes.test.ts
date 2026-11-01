import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { generateToken } from '../server/middleware/auth';
import { adminManagementRouter } from '../server/routes/admin-management';
import { managerCanAccessDemand } from '../src/domain/course-demand';
import type { User } from '../src/types';

const app=express();
app.use(express.json());
app.use('/api/admin-management',adminManagementRouter);
const ids=['usr-super','demand-test-manager','demand-test-outsider'];
let auth:{root:string;manager:string;outsider:string};
let campusId='',degreeLevelId='',majorId='';

beforeAll(async()=>{
  await db.init(true);
  const campus=db.campuses.find(c=>c.active);
  const major=db.majors.find(m=>m.active&&db.degreeLevels.some(d=>d.id===m.degreeLevelId&&d.active));
  if(!campus||!major)throw Error('Synthetic academic unit and major fixtures are required');
  campusId=campus.id;degreeLevelId=major.degreeLevelId;majorId=major.id;
  const createdAt=new Date().toISOString();
  const root:User={id:ids[0],name:'مالک تست',mobile:process.env.ROOT_OWNER_MOBILE || '09999999999',roles:['super-admin'],
    permissions:[],createdAt};
  const manager:User={id:ids[1],name:'مدیر گروه تست',mobile:'09999900002',roles:['admin'],
    permissions:['demand.manage','demand.export'],createdAt};
  const outsider:User={id:ids[2],name:'مدیر غیرمجاز',mobile:'09999900003',roles:['admin'],
    permissions:['admin.panel.access'],createdAt};
  db.data.users=db.users.filter(user=>!ids.includes(user.id));
  db.users.push(root,manager,outsider);
  auth={root:'Bearer '+generateToken(root),manager:'Bearer '+generateToken(manager),
    outsider:'Bearer '+generateToken(outsider)};
});
afterAll(()=>{
  db.data.users=db.users.filter(user=>!ids.includes(user.id));
  db.data.auditLogs=db.auditLogs.filter(log=>log.action!=='DEMAND_MANAGER_SCOPES_CHANGED' ||
    log.adminId!==ids[0]);
  db.save();
});

describe('root-scoped delegated demand management',()=>{
  it('does not grant personal-data or survey access with a permission alone',()=>{
    const manager=db.users.find(u=>u.id===ids[1])!;
    expect(managerCanAccessDemand(manager,{campusId,degreeLevelId,majorId})).toBe(false);
    expect(managerCanAccessDemand(manager,{campusId,degreeLevelId,majorId},true)).toBe(false);
  });
  it('rejects scope changes by ordinary admin accounts',async()=>{
    const endpoint=`/api/admin-management/${ids[1]}/demand-scopes`;
    const payload={scopes:[{campusId,degreeLevelId,majorId}]};
    expect((await request(app).put(endpoint).set('Authorization',auth.outsider).send(payload)).status).toBe(403);
    expect((await request(app).put(endpoint).set('Authorization',auth.manager).send(payload)).status).toBe(403);
  });
  it('rejects forged/duplicate campus-degree-major relationships',async()=>{
    const endpoint=`/api/admin-management/${ids[1]}/demand-scopes`;
    const valid={campusId,degreeLevelId,majorId};
    expect((await request(app).put(endpoint).set('Authorization',auth.root)
      .send({scopes:[{...valid,majorId:'fake-major'}]})).status).toBe(400);
    expect((await request(app).put(endpoint).set('Authorization',auth.root)
      .send({scopes:[valid,valid]})).status).toBe(400);
    expect(db.users.find(u=>u.id===ids[1])?.demandScopes).toBeUndefined();
  });
  it('allows root to delegate then revoke exactly one department and audits the changes',async()=>{
    const endpoint=`/api/admin-management/${ids[1]}/demand-scopes`;
    const valid={campusId,degreeLevelId,majorId};
    const grant=await request(app).put(endpoint).set('Authorization',auth.root)
      .send({scopes:[valid]});
    expect(grant.status).toBe(200);
    const manager=db.users.find(u=>u.id===ids[1])!;
    expect(managerCanAccessDemand(manager,valid)).toBe(true);
    expect(managerCanAccessDemand(manager,valid,true)).toBe(true);
    expect(managerCanAccessDemand(manager,{...valid,campusId:'another-campus'})).toBe(false);
    const revoke=await request(app).put(endpoint).set('Authorization',auth.root)
      .send({scopes:[]});
    expect(revoke.status).toBe(200);
    expect(managerCanAccessDemand(manager,valid)).toBe(false);
    const audit=db.auditLogs.filter(l=>l.adminId===ids[0]&&l.action==='DEMAND_MANAGER_SCOPES_CHANGED');
    expect(audit.length).toBeGreaterThanOrEqual(2);
  });
});
