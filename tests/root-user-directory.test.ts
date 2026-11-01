import { beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { generateToken } from '../server/middleware/auth';
import { adminRouter } from '../server/routes/admin';
import { adminManagementRouter } from '../server/routes/admin-management';
import type { User, StudentAcademicProfile } from '../src/types';
import {
  safeCsvCell, createDirectoryCsv, listDirectoryRecords,
} from '../server/utils/user-directory-export';

const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);
app.use('/api/admin-management', adminManagementRouter);
let rootToken='',studentToken='';
let root: User;
let student: User;
beforeAll(async () => {
  await db.init(true);
  root = db.users.find(u => u.id === 'usr-super')!;
  student = db.users.find(u => u.roles.includes('student') && !u.roles.includes('super-admin'))!;
  expect(root).toBeDefined();
  expect(student).toBeDefined();
  rootToken = generateToken(root);
  studentToken = generateToken(student);
});

const as = (token: string) => ({Authorization:`Bearer ${token}`});

describe('root-only user directory exports and role safety',()=>{
  it('requires root authentication and never exposes the CSV to students',async()=>{
    expect((await request(app).get('/api/admin/users/export')).status).toBe(401);
    expect((await request(app).get('/api/admin/users/export').set(as(studentToken))).status).toBe(403);
  });

  it('exports filtered Excel-compatible CSV with no credentials or session secrets',async()=>{
    const result=await request(app).get('/api/admin/users/export?role=student&verified=all&search=')
      .set(as(rootToken));
    expect(result.status).toBe(200);
    expect(result.headers['cache-control']).toContain('no-store');
    expect(result.headers['content-disposition']).toContain('attachment;');
    expect(result.headers['content-type']).toContain('text/csv');
    const body=result.text||result.body?.toString('utf8')||'';
    expect(body.charCodeAt(0)).toBe(0xfeff);
    expect(body).toContain('شماره دانشجویی');
    expect(body).toContain('شماره موبایل');
    expect(body).not.toContain(root.mobile);
    expect(body).not.toContain(root.password||'UNUSED_HASH');
    expect(body).not.toContain('hashedOtp');
    const audit=db.auditLogs.find(x=>x.action==='USER_DIRECTORY_EXPORTED');
    expect(audit).toBeDefined();
    expect(audit?.details).not.toContain(student.mobile);
  });

  it('rejects invalid filters without producing personal-data exports',async()=>{
    for(const query of ['?role=owner','?verified=maybe','?search='+('a'.repeat(125))]){
      const result=await request(app).get('/api/admin/users/export'+query).set(as(rootToken));
      expect(result.status).toBe(400);
    }
  });

  it('prevents root identity change and root promotion, regardless of phone number',async()=>{
    const originalName=root.name;
    const protectedRoot=await request(app).put(`/api/admin/users/${root.id}/role`)
      .set(as(rootToken)).send({role:'student'});
    expect(protectedRoot.status).toBe(403);
    expect(root.name).toBe(originalName);
    const secondRoot=await request(app).put(`/api/admin/users/${student.id}/role`)
      .set(as(rootToken)).send({role:'super-admin'});
    expect(secondRoot.status).toBe(403);
    expect(student.roles).not.toContain('super-admin');
    const created=await request(app).post('/api/admin-management')
      .set(as(rootToken)).send({name:'Another root',mobile:'09198880001',
        password:'only-a-test-password',roles:['super-admin']});
    expect(created.status).toBe(403);
    expect(db.users.filter(u=>u.roles.includes('super-admin'))).toHaveLength(1);
  });

  it('rejects illicit admin edits before mutating even their display name',async()=>{
    const name=student.name;
    const response=await request(app).put(`/api/admin-management/${student.id}`)
      .set(as(rootToken)).send({name:'This name must not persist',roles:['super-admin']});
    expect(response.status).toBe(403);
    expect(student.name).toBe(name);
  });
});

describe('directory value formatting and privacy',()=>{
  const users: User[]=[
    {id:'one',mobile:'09120000001',name:'=HYPERLINK("http://evil","Click")',
      roles:['student'],createdAt:'2026-01-01',mobileVerifiedAt:'2026-01-01'},
    {id:'two',mobile:'09120000002',name:'نام ساده',roles:['admin','student'],createdAt:'2026-01-01'},
  ];
  const profiles=[{userId:'one',studentNumber:'۴۰۵۰۰۱۲۳۴'}] as StudentAcademicProfile[];
  it('filters by Persian or ASCII digits and preserves role and verification distinctions',()=>{
    const one=listDirectoryRecords(users,profiles,{role:'student',verified:'yes',search:'405001234'});
    expect(one).toHaveLength(1);
    expect(one[0].studentNumber).toBe('۴۰۵۰۰۱۲۳۴');
    expect(listDirectoryRecords(users,profiles,{role:'admin',verified:'no',search:'نام ساده'})).toHaveLength(1);
    expect(listDirectoryRecords(users,profiles,{role:'all',verified:'yes',search:'09120000002'})).toHaveLength(0);
  });

  it('neutralizes spreadsheet formulas, quotes and CRLF before export',()=>{
    expect(safeCsvCell('=1+1')).toBe('"\'=1+1"');
    expect(safeCsvCell(' +cmd')).toBe('"\' +cmd"');
    const body=createDirectoryCsv(listDirectoryRecords(users,profiles,{role:'all',verified:'all',search:''}));
    expect(body).toContain('"\'=HYPERLINK(""http://evil"",""Click"")"');
    expect(body).not.toContain('password');
  });
});
