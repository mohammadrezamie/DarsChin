'use strict';

/**
 * Offline recovery for the RESERVED root account.
 * Requires a stopped application, persistent DB, explicit opt-in and fresh ENV.
 * Never reads Git, touches another product, or prints private values.
 */
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const bcrypt = require('bcryptjs');

function validNewSecret(value) {
  return typeof value === 'string' && value.length >= 16 && value.length <= 1024;
}

function writeNewPrivateFile(filename, data) {
  const fd = fs.openSync(filename, 'wx', 0o600);
  try {
    fs.writeFileSync(fd, data);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
}

function verifyInputs() {
  const folder = process.env.DARSCHYN_DATA_DIR;
  if (!folder || !path.isAbsolute(folder)) throw new Error('DARSCHYN_DATA_DIR must be explicitly set to an absolute persistent directory.');
  const filepath = path.join(folder, 'darschyn-db.json');
  if (!fs.existsSync(filepath) || !fs.lstatSync(filepath).isFile() || fs.lstatSync(filepath).isSymbolicLink()) {
    throw new Error('Existing regular database file required; no new DB can be created.');
  }
  const db = JSON.parse(fs.readFileSync(filepath, 'utf8'));
  if (!db || !Array.isArray(db.users)) throw new Error('Invalid database structure.');
  const roots = db.users.filter(u => u && u.id === 'usr-super');
  if (roots.length !== 1) throw new Error('Exactly one reserved root must exist; refusing automatic repair.');
  const root = roots[0];
  if (root.mobile !== process.env.ROOT_OWNER_MOBILE || !/^09\d{9}$/.test(root.mobile) ||
      !Array.isArray(root.roles) || !root.roles.includes('super-admin')) {
    throw new Error('Root identity does not match configured operator; refusing modification.');
  }
  if (!Number.isSafeInteger(root.sessionVersion ?? 0) || (root.sessionVersion ?? 0) < 0) {
    throw new Error('Invalid root session version.');
  }
  return { folder, filepath, db, root };
}

function main() {
  if (process.argv.length !== 3 || !['--check','--apply'].includes(process.argv[2])) {
    throw new Error('Usage: node scripts/rotate-root-credentials.cjs --check|--apply');
  }
  const { folder, filepath, db, root } = verifyInputs();
  if (process.argv[2] === '--check') {
    console.log('PASS: existing persistent database and reserved root identity verified. Nothing changed.');
    return;
  }
  if (process.env.NODE_ENV !== 'production' ||
      process.env.DARSCHYN_REQUIRE_EXISTING_DB !== 'true' ||
      process.env.DARSCHYN_OFFLINE_MAINTENANCE_CONFIRMED !== 'true') {
    throw new Error('Refusing write: stop app and set production, existing DB gate and explicit offline maintenance confirmation.');
  }
  const password = process.env.ROOT_OWNER_PASSWORD;
  const recovery = process.env.ROOT_OWNER_RECOVERY_KEY;
  if (!validNewSecret(password) || !validNewSecret(recovery) || password === recovery) {
    throw new Error('Two distinct strong, new root secrets of at least 16 characters are required.');
  }
  if (root.password && bcrypt.compareSync(password, root.password)) {
    throw new Error('Configured password already matches persisted password; choose a new value.');
  }
  if (root.recoveryKey === recovery ||
      (typeof root.recoveryKey === 'string' && /^\$2[aby]\$/.test(root.recoveryKey) && bcrypt.compareSync(recovery, root.recoveryKey))) {
    throw new Error('Configured recovery key matches the old one; choose a new value.');
  }
  // Hash *before* touching the persisted file or creating a backup.
  const newPasswordHash = bcrypt.hashSync(password, 10);
  const newRecoveryHash = bcrypt.hashSync(recovery, 10);
  const previous = fs.readFileSync(filepath);
  root.password = newPasswordHash;
  root.recoveryKey = newRecoveryHash;
  root.sessionVersion = (root.sessionVersion ?? 0) + 1;
  if (!Number.isSafeInteger(root.sessionVersion)) throw new Error('Session counter overflow.');
  const newData = JSON.stringify(db, null, 2);

  // A private, immutable copy stays alongside the data volume for rollback.
  // It includes the OLD credentials, so restrict and eventually expire it.
  const suffix = Date.now() + '-' + randomUUID();
  const backup = path.join(folder, '.darschyn-db.before-root-rotation-' + suffix + '.backup');
  const temp = path.join(folder, '.darschyn-db.root-rotation-' + suffix + '.tmp');
  writeNewPrivateFile(backup, previous);
  try {
    writeNewPrivateFile(temp, newData);
    fs.renameSync(temp, filepath);
    if (process.platform !== 'win32') {
      const fd = fs.openSync(folder, 'r');
      try { fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    }
  } finally {
    try { fs.unlinkSync(temp); } catch { /* rename or error removed it */ }
  }
  console.log('PASS: root credentials replaced; root JWT session version incremented.');
  console.log('Private backup retained inside configured data volume for controlled offline rollback.');
}

try {
  main();
} catch (error) {
  console.error('FAIL: ' + (error instanceof Error ? error.message : 'Unexpected error'));
  process.exitCode = 1;
}
