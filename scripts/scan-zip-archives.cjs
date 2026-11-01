'use strict';
// Bounded archive inspection for the public source gate; pure Node built-ins.
// Never extracts files to disk, executes archive contents or prints secret bytes.
const zlib = require('node:zlib');
const TEXT = /\.(?:cjs|mjs|js|jsx|ts|tsx|json|jsonl|md|txt|html|css|scss|yaml|yml|toml|xml|sql|sh|ps1|py|example|webmanifest|conf)$/i;
const MAX_ARCHIVE = 8 * 1024 * 1024;
const MAX_TOTAL = 16 * 1024 * 1024;
const MAX_ENTRY = 2 * 1024 * 1024;
const MAX_ITEMS = 1000;

function scanZipArchive(blob, findSecretKinds, findPopulatedEnvTemplateFields) {
  if (!Buffer.isBuffer(blob) || blob.length > MAX_ARCHIVE) {
    return [{ type: 'archive-too-large' }];
  }
  let eocd = -1;
  for (let i = blob.length - 22; i >= Math.max(0, blob.length - 65557); --i) {
    if (blob.readUInt32LE(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return [{ type: 'invalid-archive' }];
  const entryCount = blob.readUInt16LE(eocd + 10);
  const centralStart = blob.readUInt32LE(eocd + 16);
  if (entryCount > MAX_ITEMS || entryCount === 0xffff ||
      blob.readUInt16LE(eocd + 8) !== entryCount ||
      blob.readUInt16LE(eocd + 4) !== 0 || blob.readUInt16LE(eocd + 6) !== 0 ||
      centralStart >= eocd) return [{ type: 'unsupported-archive-layout' }];
  let p = centralStart, total = 0;
  const findings = [];
  try {
    for (let i = 0; i < entryCount; i++) {
      if (p + 46 > blob.length || blob.readUInt32LE(p) !== 0x02014b50) throw Error('central-entry');
      const flags = blob.readUInt16LE(p + 8);
      const method = blob.readUInt16LE(p + 10);
      const compressedSize = blob.readUInt32LE(p + 20);
      const uncompressedSize = blob.readUInt32LE(p + 24);
      const nameLength = blob.readUInt16LE(p + 28);
      const extra = blob.readUInt16LE(p + 30);
      const comment = blob.readUInt16LE(p + 32);
      const local = blob.readUInt32LE(p + 42);
      if (p + 46 + nameLength + extra + comment > blob.length) throw Error('truncated-entry');
      const name = blob.subarray(p + 46, p + 46 + nameLength).toString('utf8').replace(/\\/g, '/');
      p += 46 + nameLength + extra + comment;
      if (name.endsWith('/')) continue;
      // Only structured paths are safe to bundle; never allow extraction escapes.
      if (!name || name.startsWith('/') || name.split('/').includes('..') ||
          name.includes('\0') || /^[A-Za-z]:\//.test(name)) {
        findings.push({ type: 'unsafe-archive-path' });
        continue;
      }
      if (flags & 1 || compressedSize === 0xffffffff || uncompressedSize === 0xffffffff ||
          uncompressedSize > MAX_ENTRY || compressedSize > MAX_ARCHIVE ||
          ![0, 8].includes(method)) {
        findings.push({ type: 'unscannable-archive-entry' });
        continue;
      }
      total += uncompressedSize;
      if (total > MAX_TOTAL) { findings.push({ type: 'archive-expansion-limit' }); break; }
      if (local + 30 > blob.length || blob.readUInt32LE(local) !== 0x04034b50) throw Error('local-header');
      const dataStart = local + 30 + blob.readUInt16LE(local + 26) + blob.readUInt16LE(local + 28);
      if (dataStart + compressedSize > blob.length) throw Error('entry-data');
      // A release ZIP must not smuggle persisted local account data.
      if (/(^|\\/)data\\/.*\\.(?:json|jsonl|csv|log|sqlite|db)$/i.test(name)) {
        findings.push({ type: 'embedded-runtime-data' });
        continue;
      }
      if (/(^|\/)\.env(?:\.|$)/i.test(name) && !name.endsWith('.env.example')) {
        findings.push({ type: 'embedded-private-env' });
        continue;
      }
      if (/\.(?:pem|pfx|p12|key|sqlite|db|bak|backup|zip)$/i.test(name)) {
        findings.push({ type: 'embedded-sensitive-file' });
        continue;
      }
      if (!TEXT.test(name)) continue;
      const compressed = blob.subarray(dataStart, dataStart + compressedSize);
      const data = method === 0 ? compressed :
        zlib.inflateRawSync(compressed, { maxOutputLength: MAX_ENTRY + 1 });
      if (data.length !== uncompressedSize) throw Error('uncompressed-size');
      const content = data.toString('utf8');
      for (const kind of findSecretKinds(content)) findings.push({ type: 'archive-' + kind });
      if (name.endsWith('.env.example')) {
        for (const key of findPopulatedEnvTemplateFields(content)) {
          findings.push({ type: 'archive-populated-example-' + key });
        }
      }
    }
  } catch {
    findings.push({ type: 'invalid-archive-structure' });
  }
  return findings;
}
module.exports = { scanZipArchive };
