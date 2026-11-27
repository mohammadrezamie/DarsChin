import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

/**
 * Crash-resistant single-process JSON persistence.
 *
 * Write a fresh private file, flush its bytes, rename within the same
 * filesystem and flush the containing directory (where supported). Never
 * truncate the previous database file or reuse a stale .tmp across restarts.
 *
 * This is not a cross-process transaction system. More than one Node worker
 * requires a shared transactional database instead of this JSON store.
 */
export function writeDurableJson(filePath: string, data: unknown, onReplaced?: () => void, requireExisting = false): void {
  const directory = path.dirname(filePath);
  if (requireExisting) assertExistingDatabasePresent(filePath, true);
  else fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  // JSON.stringify may throw (e.g. cyclic data). Do this before touching disk.
  const serialized = JSON.stringify(data, null, 2);
  if (typeof serialized !== 'string') {
    throw new TypeError('Database JSON must serialize to a value');
  }

  const temporary = path.join(directory, `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`);
  let fd: number | undefined;
  try {
    fd = fs.openSync(temporary, 'wx', 0o600);
    fs.writeFileSync(fd, serialized, { encoding: 'utf8' });
    fs.fsyncSync(fd);
    fs.closeSync(fd);
    fd = undefined;
    if (requireExisting) assertExistingDatabasePresent(filePath, true);
    fs.renameSync(temporary, filePath);
    // The new file is visible after rename. Notify an in-memory importer
    // *before* flushing the directory, so even a late fsync failure cannot
    // make the next save silently roll back the already-replaced file.
    onReplaced?.();

    // On POSIX, flushing the directory makes the rename durable across a
    // power failure. Windows cannot always open a directory as a file.
    if (process.platform !== 'win32') {
      const directoryFd = fs.openSync(directory, 'r');
      try {
        fs.fsyncSync(directoryFd);
      } finally {
        fs.closeSync(directoryFd);
      }
    }
  } catch (error) {
    if (fd !== undefined) {
      try { fs.closeSync(fd); } catch { /* Retain the original error. */ }
    }
    try { fs.unlinkSync(temporary); } catch { /* Missing after rename is expected. */ }
    throw error;
  }
}

export function assertExistingDatabasePresent(filePath: string, requireExisting: boolean): void {
  if (!requireExisting) return;
  const stat = fs.lstatSync(filePath, { throwIfNoEntry: false });
  if (!stat || !stat.isFile() || stat.isSymbolicLink()) {
    throw new Error('The required persisted database is missing or is not a regular file; refusing to initialize an empty replacement.');
  }
}

/**
 * Existing databases are never replaced by sample data after a read or parse
 * failure, regardless of NODE_ENV. Retain original bytes for forensic restore.
 */
export function readPersistedJson(filePath: string): unknown {
  const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
      !Array.isArray((parsed as { users?: unknown }).users)) {
    throw new Error('Persisted database has an invalid root/users collection');
  }
  // Missing legacy collections may still be migrated; present but malformed
  // collections must never be silently reset by migration/bootstrap.
  const record = parsed as Record<string, unknown>;
  const arrays = ['universities','provinces','campuses','degreeLevels','majors','tracks',
    'entryYears','academicTerms','curricula','courses','curriculumCourses','academicRules',
    'courseOfferings','studentProfiles','studentPassedCourses','studentPlans','demandSurveys',
    'demandResponses','importBatches','importRecords','supportTickets','supportMessages',
    'bugReports','auditLogs','errorLogs','otpChallenges','captchaChallenges','smsHistory',
    'syncJobs','syncSnapshots'];
  for (const key of arrays) {
    if (Object.hasOwn(record, key) && (!Array.isArray(record[key]) ||
        (record[key] as unknown[]).some(row => !row || typeof row !== 'object' || Array.isArray(row)))) {
      throw new Error('Persisted database has a malformed collection: ' + key);
    }
  }
  for (const key of ['academicSettings','smsSettings']) {
    if (Object.hasOwn(record,key) && (!record[key] || typeof record[key] !== 'object' || Array.isArray(record[key]))) {
      throw new Error('Persisted database has malformed settings: ' + key);
    }
  }
  // The previous loader silently deleted duplicate/invalid user identities.
  // That could discard a real student's plan when root/bootstrap saved again.
  // Block startup and require a reviewed repair instead of losing accounts.
  const seen = new Set<string>();
  for (const user of (parsed as { users: unknown[] }).users) {
    if (!user || typeof user !== 'object' || Array.isArray(user) ||
        typeof (user as { id?: unknown }).id !== 'string' ||
        !(user as { id: string }).id.trim() ||
        seen.has((user as { id: string }).id)) {
      throw new Error('Persisted database has a missing or duplicate user identity');
    }
    seen.add((user as { id: string }).id);
  }
  return parsed;
}
