import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {randomBytes} from 'node:crypto';
import {afterEach,describe,expect,it} from 'vitest';
import {runOfflineBackup} from '../scripts/offline-backup';
const roots:string[]=[];
function fixture(){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'darschin-backup-test-'));roots.push(root);
 const dir=(name:string)=>{const p=path.join(root,name);fs.mkdirSync(p,{mode:0o700});return p;};
 const source=path.join(dir('source'),'darschyn-db.json'),key=path.join(dir('key'),'random.key');
 const archive=path.join(dir('archive'),'test.dcb'),restore=path.join(dir('restore'),'darschyn-db.json');
 const data={users:[{id:'synthetic',password:'synthetic-hash',sessionVersion:7}],universities:[],campuses:[],degreeLevels:[],majors:[],entryYears:[],academicTerms:[],curricula:[],courses:[],curriculumCourses:[],academicRules:[],courseOfferings:[],studentProfiles:[],studentPassedCourses:[],academicSettings:{normalMaxUnits:20},studentPlans:[{id:'synthetic-plan'}]};
 const bytes=Buffer.from(JSON.stringify(data));
 fs.writeFileSync(source,bytes,{mode:0o600});fs.writeFileSync(key,randomBytes(32),{mode:0o600});
 return {source,key,archive,restore,bytes,root};
}
afterEach(()=>{for(const root of roots.splice(0))fs.rmSync(root,{recursive:true,force:true});});
describe('offline authenticated disaster recovery',()=>{
 it('encrypts and verifies a complete snapshot and restores exact bytes into a new private file',()=>{
   const f=fixture();runOfflineBackup('backup',f.source,f.key,f.archive);
   expect(fs.readFileSync(f.archive).includes(Buffer.from('synthetic-hash'))).toBe(false);
   runOfflineBackup('verify',f.archive,f.key);runOfflineBackup('restore-new',f.archive,f.key,f.restore);
   expect(fs.readFileSync(f.restore)).toEqual(f.bytes);
   expect(fs.readFileSync(f.source)).toEqual(f.bytes);
   expect(fs.statSync(f.restore).mode&0o777).toBe(0o600);
 });
 it('rejects altered and truncated archives without creating plaintext',()=>{
   const f=fixture();runOfflineBackup('backup',f.source,f.key,f.archive);
   const original=fs.readFileSync(f.archive);
   for(const bytes of [Buffer.from(original),original.subarray(0,original.length-1)]){
     bytes[bytes.length-1]^=1;fs.writeFileSync(f.archive,bytes);
     expect(()=>runOfflineBackup('restore-new',f.archive,f.key,f.restore)).toThrow();
     expect(fs.existsSync(f.restore)).toBe(false);
   }
 });
 it('rejects wrong keys and incomplete databases',()=>{
   const f=fixture();runOfflineBackup('backup',f.source,f.key,f.archive);
   fs.writeFileSync(f.key,randomBytes(32));
   expect(()=>runOfflineBackup('verify',f.archive,f.key)).toThrow();
   fs.unlinkSync(f.archive);fs.writeFileSync(f.source,JSON.stringify({users:[]}));
   expect(()=>runOfflineBackup('backup',f.source,f.key,f.archive)).toThrow(/Incomplete/);
   expect(fs.existsSync(f.archive)).toBe(false);
 });
 it('never overwrites archive or destination and leaves no temporary files',()=>{
   const f=fixture();runOfflineBackup('backup',f.source,f.key,f.archive);
   const before=fs.readFileSync(f.archive);
   expect(()=>runOfflineBackup('backup',f.source,f.key,f.archive)).toThrow();
   fs.writeFileSync(f.restore,'existing',{mode:0o600});
   expect(()=>runOfflineBackup('restore-new',f.archive,f.key,f.restore)).toThrow();
   expect(fs.readFileSync(f.archive)).toEqual(before);
   expect(fs.readFileSync(f.restore,'utf8')).toBe('existing');
   expect(fs.readdirSync(path.dirname(f.restore))).toEqual(['darschyn-db.json']);
 });
 it('rejects public permissions, symlinks, and co-located key material',()=>{
   const f=fixture();fs.chmodSync(f.key,0o644);
   expect(()=>runOfflineBackup('backup',f.source,f.key,f.archive)).toThrow();
   fs.chmodSync(f.key,0o600);const moved=path.join(path.dirname(f.source),'key');
   fs.copyFileSync(f.key,moved);expect(()=>runOfflineBackup('backup',f.source,moved,f.archive)).toThrow();
   const symlink=path.join(path.dirname(f.key),'link');fs.symlinkSync(f.key,symlink);
   expect(()=>runOfflineBackup('backup',f.source,symlink,f.archive)).toThrow();
 });
 it('uses fresh nonces even for identical snapshots',()=>{
   const f=fixture();const second=path.join(path.dirname(f.archive),'second.dcb');
   runOfflineBackup('backup',f.source,f.key,f.archive);runOfflineBackup('backup',f.source,f.key,second);
   expect(fs.readFileSync(f.archive)).not.toEqual(fs.readFileSync(second));
 });
});
