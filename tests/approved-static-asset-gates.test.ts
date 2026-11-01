import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import allowed from '../extension/public-files.json';
import { approvedExtensionStaticGate, approvedMockPortalStaticGate } from '../server/middleware/approved-static';
import { publicExtensionAssets } from '../server/security/extension-public-files';

const secret = 'SYNTHETIC_PRIVATE_KEY_MUST_NEVER_BE_PUBLIC_20261101';
const created: string[] = [];
afterEach(() => {
  for (const dir of created.splice(0)) fs.rmSync(dir,{force:true,recursive:true});
});
function makeFolder() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(),'darschin-public-static-'));
  created.push(root);
  return root;
}
function makeAssets(root:string) {
  for(const file of allowed) {
    const absolute=path.join(root,file);
    fs.mkdirSync(path.dirname(absolute),{recursive:true});
    fs.writeFileSync(absolute,file.endsWith('.json') ? '{"value":"SAFE_PUBLIC_ASSET"}' : 'SAFE_PUBLIC_ASSET');
  }
}
function extensionApp(root:string) {
  const app=express();
  app.use('/extension-files',approvedExtensionStaticGate(root));
  app.use('/extension-files',express.static(root,{dotfiles:'deny',fallthrough:false}));
  return app;
}
describe('strict extension / mock-portal HTTP static allowlists',()=>{
  it('serves approved Chrome extension paths and forbids even ordinary extra files',async()=>{
    const root=makeFolder();makeAssets(root);
    fs.writeFileSync(path.join(root,'private.key'),secret);
    fs.writeFileSync(path.join(root,'backup.json'),secret);
    fs.writeFileSync(path.join(root,'.env'),secret);
    fs.writeFileSync(path.join(root,'icons','unapproved.txt'),secret);
    const app=extensionApp(root);
    for (const url of ['/extension-files/manifest.json','/extension-files/popup.js',
      '/extension-files/icons/icon16.png','/extension-files/fonts/vazirmatn.css']) {
      const response=await request(app).get(url);
      expect(response.status).toBe(200);
      expect(JSON.stringify(response.body || '') + (response.text || '')).toContain('SAFE_PUBLIC_ASSET');
    }
    for (const url of ['/extension-files/private.key','/extension-files/backup.json',
      '/extension-files/.env','/extension-files/public-files.json',
      '/extension-files/icons/unapproved.txt','/extension-files/extra-folder/secret.json']) {
      const response=await request(app).get(url);
      expect(response.status).toBe(404);
      expect(JSON.stringify(response.body)+response.text).not.toContain(secret);
    }
  });
  it('does not allow symlinks escaping the extension directory, including intermediate folders',async()=>{
    const root=makeFolder(),outside=makeFolder();
    makeAssets(root);
    fs.writeFileSync(path.join(outside,'private.key'),secret);
    fs.rmSync(path.join(root,'icons'),{recursive:true,force:true});
    fs.mkdirSync(path.join(outside,'icons'),{recursive:true});
    fs.writeFileSync(path.join(outside,'icons','icon16.png'),secret);
    fs.symlinkSync(path.join(outside,'icons'),path.join(root,'icons'));
    const app=extensionApp(root);
    const response=await request(app).get('/extension-files/icons/icon16.png');
    expect(response.status).toBe(404);
    expect(response.text||'').not.toContain(secret);
    expect(()=>publicExtensionAssets(root)).toThrow();
  });
  it('allows only the demo portal HTML, not runtime dumps or newly added scripts',async()=>{
    const root=makeFolder();
    fs.writeFileSync(path.join(root,'index.html'),'<html>Safe educational portal demo</html>');
    fs.writeFileSync(path.join(root,'database.json'),secret);
    fs.writeFileSync(path.join(root,'private.js'),secret);
    const app=express();
    app.use('/mock-portal-static',approvedMockPortalStaticGate(root));
    app.use('/mock-portal-static',express.static(root,{dotfiles:'deny',fallthrough:false}));
    expect((await request(app).get('/mock-portal-static/index.html')).status).toBe(200);
    expect((await request(app).get('/mock-portal-static/')).status).toBe(200);
    for(const file of ['database.json','private.js']) {
      const response=await request(app).get('/mock-portal-static/'+file);
      expect(response.status).toBe(404);
      expect(response.text||'').not.toContain(secret);
    }
  });
  it('the real Express entry must mount both guards before serving static files',()=>{
    const server=fs.readFileSync(path.resolve(process.cwd(),'server.ts'),'utf8');
    expect(server).toContain("app.use('/extension-files', approvedExtensionStaticGate(extensionPath))");
    expect(server).toContain("app.use('/mock-portal-static', approvedMockPortalStaticGate(mockPortalPath))");
    expect(server).not.toContain("app.use('/extension-files', express.static(extensionPath));");
    expect(server).not.toContain("app.use('/mock-portal-static', express.static(mockPortalPath));");
  });
});
