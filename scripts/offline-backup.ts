// Offline operator utility; no network, live database overwrite or credentials in logs.
import fs from 'node:fs';
import path from 'node:path';
import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { parsePersistedJson } from '../server/db/durable-json';

const MAGIC = Buffer.from('DARSCHIN-DB-V1\n','ascii');
const NONCE_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const MAX_BYTES = 64 * 1024 * 1024;
const OVERHEAD = MAGIC.length + NONCE_BYTES + TAG_BYTES;
const repoRoot = fs.realpathSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'));
type Operation = 'backup' | 'verify' | 'restore-new';

function privateLocation(filename: string): string {
  if (process.platform === 'win32') throw new Error('Linux/POSIX private filesystem required');
  if (!path.isAbsolute(filename)) throw new Error('Absolute path required');
  const parent = fs.realpathSync(path.dirname(filename));
  const rel = path.relative(repoRoot,parent);
  if (rel === '' || (!rel.startsWith('..'+path.sep) && rel !== '..' && !path.isAbsolute(rel))) {
    throw new Error('Files must be outside repository');
  }
  const stat = fs.statSync(parent);
  if (!stat.isDirectory() || (stat.mode & 0o077) !== 0) throw new Error('Private directory required');
  return path.join(parent,path.basename(filename));
}

function readPrivate(filename: string, max: number): Buffer {
  const fd = fs.openSync(filename, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW | fs.constants.O_NONBLOCK);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || (stat.mode & 0o077) !== 0 || stat.size < 1 || stat.size > max) {
      throw new Error('Private regular file with bounded size required');
    }
    const bytes = Buffer.alloc(stat.size);
    let offset = 0;
    while(offset < bytes.length) {
      const n = fs.readSync(fd,bytes,offset,bytes.length-offset,null);
      if(n===0) throw new Error('Source changed during read');
      offset+=n;
    }
    if(fs.readSync(fd,Buffer.alloc(1),0,1,null)!==0) throw new Error('Source changed during read');
    return bytes;
  } finally {fs.closeSync(fd);}
}

function validateSnapshot(bytes: Buffer): void {
  const data = parsePersistedJson(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) as Record<string,unknown>;
  for(const name of ['universities','campuses','degreeLevels','majors','entryYears','academicTerms','curricula','courses','curriculumCourses','academicRules','courseOfferings','studentProfiles','studentPassedCourses']) {
    if(!Array.isArray(data[name])) throw new Error('Incomplete database snapshot');
  }
  if(!data.academicSettings) throw new Error('Incomplete database snapshot');
}

function encrypt(bytes: Buffer,key: Buffer): Buffer {
  validateSnapshot(bytes);
  const nonce=randomBytes(NONCE_BYTES);
  const header=Buffer.concat([MAGIC,nonce]);
  const cipher=createCipheriv('aes-256-gcm',key,nonce,{authTagLength:TAG_BYTES});
  cipher.setAAD(header);
  return Buffer.concat([header,cipher.update(bytes),cipher.final(),cipher.getAuthTag()]);
}

function decrypt(bytes: Buffer,key: Buffer): Buffer {
  if(bytes.length<=OVERHEAD || !bytes.subarray(0,MAGIC.length).equals(MAGIC)) throw new Error('Invalid backup format');
  const header=bytes.subarray(0,MAGIC.length+NONCE_BYTES);
  const decipher=createDecipheriv('aes-256-gcm',key,header.subarray(MAGIC.length),{authTagLength:TAG_BYTES});
  decipher.setAAD(header);
  decipher.setAuthTag(bytes.subarray(bytes.length-TAG_BYTES));
  // Never publish unauthenticated plaintext before final() succeeds.
  const plain=Buffer.concat([decipher.update(bytes.subarray(header.length,bytes.length-TAG_BYTES)),decipher.final()]);
  validateSnapshot(plain);
  return plain;
}

function publishNew(filename: string, bytes: Buffer): void {
  const dir=path.dirname(filename);
  const temporary=path.join(dir,'.darschin-backup-'+randomUUID()+'.tmp');
  let fd: number|undefined;
  try {
    fd=fs.openSync(temporary,'wx',0o600);
    fs.writeFileSync(fd,bytes);
    fs.fsyncSync(fd);
    fs.closeSync(fd);fd=undefined;
    // Hard-link is atomic and refuses any existing destination, including symlinks.
    fs.linkSync(temporary,filename);
    fs.unlinkSync(temporary);
    const dirFd=fs.openSync(dir,'r');
    try{fs.fsyncSync(dirFd);}finally{fs.closeSync(dirFd);}
  } finally {
    if(fd!==undefined)try{fs.closeSync(fd);}catch{}
    try{fs.unlinkSync(temporary);}catch{}
  }
}

export function runOfflineBackup(operation: Operation, source: string, keyFile: string, destination?: string): void {
  if(!['backup','verify','restore-new'].includes(operation)) throw new Error('Unknown operation');
  const input=privateLocation(source),keyPath=privateLocation(keyFile);
  const output=destination?privateLocation(destination):undefined;
  if((operation==='verify')!==!output) throw new Error('Invalid destination');
  if(operation==='backup' && (path.basename(input)!=='darschyn-db.json'||!output?.endsWith('.dcb'))) throw new Error('Invalid backup filenames');
  if(operation!=='backup' && !input.endsWith('.dcb')) throw new Error('Invalid archive filename');
  if(operation==='restore-new' && path.basename(output!)!=='darschyn-db.json') throw new Error('Invalid restore filename');
  if(path.dirname(input)===path.dirname(keyPath) || (output && (path.dirname(output)===path.dirname(keyPath)||path.dirname(output)===path.dirname(input)))) throw new Error('Use separate private source, key and destination directories');
  const key=readPrivate(keyPath,KEY_BYTES);
  try{
    if(key.length!==KEY_BYTES)throw new Error('A 32-byte random key file is required');
    const bytes=readPrivate(input,operation==='backup'?MAX_BYTES:MAX_BYTES+OVERHEAD);
    try {
      if(operation==='backup') publishNew(output!,encrypt(bytes,key));
      else {
        const plain=decrypt(bytes,key);
        try {if(operation==='restore-new')publishNew(output!,plain);}
        finally{plain.fill(0);}
      }
    } finally {bytes.fill(0);}
  } finally {key.fill(0);}
}

if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  try{
    const [operation,source,key,destination,...extra]=process.argv.slice(2);
    if(extra.length||!source||!key||process.env.DARSCHYN_OFFLINE_MAINTENANCE_CONFIRMED!=='true')throw new Error('Explicit offline confirmation and paths required');
    runOfflineBackup(operation as Operation,source,key,destination);
    console.log('PASS: offline backup operation completed; no active database overwritten.');
  }catch{
    // Do not expose filenames, filesystem errors, parsed data or key material.
    console.error('FAIL: offline backup operation rejected or durability uncertain; inspect private inputs and destination locally.');
    process.exitCode=1;
  }
}
