import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { db } from '../server/db/database';
import { generateToken } from '../server/middleware/auth';
import { adminRouter } from '../server/routes/admin';
import { apiErrorHandler } from '../server/middleware/api-error';
import { publicExtensionAssets } from '../server/security/extension-public-files';
import allowed from '../extension/public-files.json';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readFileSync } from 'node:fs';

const privateMarker = 'SYNTHETIC_PRIVATE_KEY_LOCATION:/operator/private/.env';
let rootAuth = '';
beforeAll(async () => {
  await db.init(true);
  const root = db.users.find(user=>user.id==='usr-super');
  if (!root) throw Error('Missing synthetic test root');
  rootAuth = 'Bearer '+generateToken(root);
});
afterEach(() => vi.restoreAllMocks());

describe('private server exceptions and downloads', () => {
  it('redacts private error text, stacks and path from both HTTP and logs', async () => {
    const app=express();
    app.get('/api/error/:id', (_req,_res)=>{throw new Error(privateMarker);});
    app.use('/api',apiErrorHandler);
    const log=vi.spyOn(console,'error').mockImplementation(()=>{});
    const result=await request(app).get('/api/error/'+encodeURIComponent(privateMarker));
    expect(result.status).toBe(500);
    expect(JSON.stringify(result.body)).not.toContain(privateMarker);
    expect(JSON.stringify(log.mock.calls)).not.toContain(privateMarker);
    expect(log).toHaveBeenCalled();
  });
  it('returns 400 for hostile/malformed JSON and never logs the submitted text', async () => {
    const app=express();
    app.use(express.json());
    app.post('/api/post', (_req,res)=>res.json({ok:true}));
    app.use('/api',apiErrorHandler);
    const log=vi.spyOn(console,'error').mockImplementation(()=>{});
    const result=await request(app).post('/api/post').set('Content-Type','application/json')
      .send('{"'+privateMarker+'":');
    expect(result.status).toBe(400);
    expect(JSON.stringify(result.body)).not.toContain(privateMarker);
    expect(JSON.stringify(log.mock.calls)).not.toContain(privateMarker);
  });
  it('does not return any root backup if export audit cannot be persisted', async () => {
    const app=express();
    app.use('/api/admin',adminRouter);
    const before=db.auditLogs.length;
    const fail=vi.spyOn(db,'save').mockImplementationOnce(()=>{throw Error(privateMarker);});
    let result;
    try{result=await request(app).get('/api/admin/backup').set('Authorization',rootAuth);}
    finally{fail.mockRestore();}
    expect(result.status).toBe(503);
    expect(result.body.users).toBeUndefined();
    expect(JSON.stringify(result.body)).not.toContain(privateMarker);
    expect(db.auditLogs).toHaveLength(before);
  });
  it('does not release student XLSX when audit write fails', async () => {
    const app=express();
    app.use('/api/admin',adminRouter);
    const before=db.auditLogs.length;
    const fail=vi.spyOn(db,'save').mockImplementationOnce(()=>{throw Error(privateMarker);});
    let result;
    try{result=await request(app).get('/api/admin/users/export.xlsx').set('Authorization',rootAuth);}
    finally{fail.mockRestore();}
    expect(result.status).toBe(503);
    expect(JSON.stringify(result.body)).not.toContain(privateMarker);
    expect(db.auditLogs).toHaveLength(before);
    expect(result.headers['content-type']).toContain('application/json');
  });
});

describe('no arbitrary files in packaged extension archives', () => {
  it('excludes untracked local secrets when generating the public release asset list', () => {
    const temp=fs.mkdtempSync(path.join(os.tmpdir(),'darschin-ext-allowlist-'));
    try {
      for (const name of allowed) {
        const file=path.join(temp,name);
        fs.mkdirSync(path.dirname(file),{recursive:true});
        fs.writeFileSync(file,'SYNTHETIC_PUBLIC_ASSET');
      }
      fs.writeFileSync(path.join(temp,'.env'),privateMarker);
      fs.writeFileSync(path.join(temp,'private.key'),privateMarker);
      const names=publicExtensionAssets(temp).map(x=>x.archiveName);
      expect(names).toEqual(allowed);
      expect(names).not.toContain('.env');
      expect(names).not.toContain('private.key');
      const source=readFileSync(path.resolve(process.cwd(),'server.ts'),'utf8');
      const packager=readFileSync(path.resolve(process.cwd(),'scripts/package-extension.cjs'),'utf8');
      expect(source).toContain('publicExtensionAssets(extDir)');
      expect(source).not.toContain('archive.directory(extDir, false)');
      expect(packager).not.toContain("zip.addLocalFolder('extension'");
      expect(packager).toContain('zip.addFile(name');
    } finally {fs.rmSync(temp,{recursive:true,force:true});}
  });
  it('rejects a symlink replacing an approved asset instead of following outside files', () => {
    const temp=fs.mkdtempSync(path.join(os.tmpdir(),'darschin-ext-link-'));
    try {
      const first=allowed[0];
      fs.symlinkSync(path.resolve(process.cwd(),'package.json'),path.join(temp,first));
      expect(()=>publicExtensionAssets(temp)).toThrow();
    } finally{fs.rmSync(temp,{recursive:true,force:true});}
  });
});
