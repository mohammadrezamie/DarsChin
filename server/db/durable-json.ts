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
export function writeDurableJson(filePath: string, data: unknown): void {
  const directory = path.dirname(filePath);
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
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
    fs.renameSync(temporary, filePath);

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
  if (requireExisting && !fs.existsSync(filePath)) {
    throw new Error('The required persisted database is missing; refusing to initialize an empty replacement.');
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
  return parsed;
}
