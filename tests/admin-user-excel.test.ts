import { beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import AdmZip from 'adm-zip';
import { db } from '../server/db/database';
import { adminRouter } from '../server/routes/admin';
import { generateToken } from '../server/middleware/auth';
import { userDirectoryXlsx } from '../server/utils/user-excel';
import type { User } from '../src/types';

describe('root-only Excel directory and spreadsheet safety', () => {
  it('writes real XLSX (ZIP + OOXML) with inline text cells and escaped hostile names', () => {
    const payload = userDirectoryXlsx([{
      name: '=HYPERLINK("https://malicious.test","click") & <test>',
      mobile: '09120000000', studentNumber: '403123456', roles: 'student',
      verified: 'تأییدنشده', permissions: '',
    }]);
    const workbook = new AdmZip(payload);
    expect(workbook.getEntry('[Content_Types].xml')).toBeTruthy();
    expect(workbook.getEntry('xl/workbook.xml')).toBeTruthy();
    const xml = workbook.readAsText('xl/worksheets/sheet1.xml');
    expect(xml).toContain('rightToLeft="1"');
    expect(xml).toContain('t="inlineStr"');
    expect(xml).toContain('&lt;test&gt;');
    expect(xml).toContain('403123456');
    expect(xml).not.toContain('<f>');
    expect(xml).not.toContain('https://malicious.test","click") & <test>');
    expect(xml).not.toContain('password');
  });

  it('rejects an unbounded export', () => {
    const row = {name:'x',mobile:'',studentNumber:'',roles:'student',verified:'',permissions:''};
    expect(() => userDirectoryXlsx(Array(20001).fill(row))).toThrow(RangeError);
  });
});

const app = express();
app.use(express.json());
app.use('/api/admin', adminRouter);
const testStudentId = 'usr-test-excel-student-20261028';
let rootToken = '';
let adminToken = '';
beforeAll(async () => {
  await db.init(true);
  const root = db.users.find(user => user.roles.includes('super-admin'));
  if (!root) throw new Error('Isolated root account is required for this security test');
  rootToken = generateToken(root);
  const student: User = {
    id:testStudentId, mobile:'09128884455', name:'کاربر آزمایشی اکسل',
    roles:['student'], permissions:[], createdAt:new Date().toISOString(),
  };
  if (!db.users.some(u => u.id === student.id)) db.users.push(student);
  db.studentProfiles.push({
    userId:testStudentId, universityId:'u-test',campusId:'c-test',degreeLevelId:'d-test',
    majorId:'m-test',entryYearId:'e-test',isTrackSelected:false,desiredTrackIds:[],
    studentNumber:'STU-EXCEL-0148',
    updatedAt:new Date().toISOString(),
  });
  const manager: User = {
    id:'usr-test-excel-manager',mobile:'09128884477',name:'مدیر آزمایشی',
    roles:['admin'],permissions:['admin.panel.access'],createdAt:new Date().toISOString(),
  };
  db.users.push(manager);
  adminToken = generateToken(manager);
  db.save();
});

describe('single reserved root and delegated role boundaries', () => {
  it('never permits creating another root or demoting the reserved root', async () => {
    const rootId = 'usr-super';
    const studentId = testStudentId;
    const oldRoot = db.users.find(u => u.id === rootId);
    const beforeRootRoles = [...(oldRoot?.roles ?? [])];
    const rejectElevation = await request(app).put(`/api/admin/users/${studentId}/role`)
      .set('Authorization', `Bearer ${rootToken}`).send({role:'super-admin'});
    expect(rejectElevation.status).toBe(400);
    expect(db.users.find(u => u.id === studentId)?.roles).toEqual(['student']);

    const rejectDemotion = await request(app).put(`/api/admin/users/${rootId}/role`)
      .set('Authorization', `Bearer ${rootToken}`).send({role:'student'});
    expect(rejectDemotion.status).toBe(403);
    expect(db.users.find(u => u.id === rootId)?.roles).toEqual(beforeRootRoles);
    expect(db.users.filter(u => u.roles.includes('super-admin'))).toHaveLength(1);
  });

  it('delegates ordinary admin access without creating a second root identity', async () => {
    const result = await request(app).put(`/api/admin/users/${testStudentId}/role`)
      .set('Authorization', `Bearer ${rootToken}`).send({role:'admin'});
    expect(result.status).toBe(200);
    expect(db.users.find(u=>u.id===testStudentId)?.roles).toEqual(['admin','student']);
    const undo = await request(app).put(`/api/admin/users/${testStudentId}/role`)
      .set('Authorization', `Bearer ${rootToken}`).send({role:'student'});
    expect(undo.status).toBe(200);
    expect(db.users.find(u=>u.id===testStudentId)?.roles).toEqual(['student']);
  });
});

describe('Excel export API boundaries', () => {
  it('blocks anonymous and delegated management from exporting all users', async () => {
    expect((await request(app).get('/api/admin/users/export.xlsx')).status).toBe(401);
    expect((await request(app).get('/api/admin/users/export.xlsx')
      .set('Authorization', `Bearer ${adminToken}`)).status).toBe(403);
  });

  it('allows only permitted role filters and no private backup data in the spreadsheet', async () => {
    expect((await request(app).get('/api/admin/users/export.xlsx?role=unknown')
      .set('Authorization', `Bearer ${rootToken}`)).status).toBe(400);
    const response = await request(app).get('/api/admin/users/export.xlsx?role=student')
      .set('Authorization', `Bearer ${rootToken}`).buffer(true).parse((res,done)=>{
        const chunks: Buffer[] = [];
        res.on('data',data=>chunks.push(data));
        res.on('end',()=>done(null,Buffer.concat(chunks)));
      });
    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toContain('spreadsheetml.sheet');
    expect(response.headers['cache-control']).toContain('no-store');
    const xml = new AdmZip(response.body as Buffer).readAsText('xl/worksheets/sheet1.xml');
    expect(xml).toContain('STU-EXCEL-0148');
    expect(xml).toContain('کاربر آزمایشی اکسل');
    expect(xml).not.toContain('مدیر آزمایشی');
    expect(xml).not.toContain('recoveryKey');
    expect(xml).not.toContain('<f>');
    const audit = db.auditLogs.find(log=>log.action==='USER_DIRECTORY_EXPORTED');
    expect(audit?.details).toContain('"role":"student"');
    expect(audit?.details).not.toContain('09128884455');
  });
});
