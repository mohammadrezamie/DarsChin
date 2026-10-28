import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InvalidCatalogBackupError, prepareCatalogRestore } from '../server/db/catalog-restore';
import type { DatabaseSchema } from '../server/db/database';

const folders: string[] = [];
const temporary = () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'darschin-catalog-restore-'));
  folders.push(dir);
  return dir;
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.resetModules();
  for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true });
});

function fixture(): DatabaseSchema {
  return {
    users: [{ id: 'u1', mobile: '09999999991', password: 'secure-hash', sessionVersion: 9, roles: ['student'] }],
    universities: [{ id: 'u' }],
    provinces: [],
    campuses: [{ id: 'camp', universityId: 'u' }],
    degreeLevels: [{ id: 'deg' }],
    majors: [{ id: 'major', degreeLevelId: 'deg' }],
    tracks: [],
    entryYears: [{ id: 'entry' }],
    academicTerms: [{ id: 'term' }],
    curricula: [{ id: 'chart', universityId: 'u', campusId: 'camp', degreeLevelId: 'deg', majorId: 'major', entryYearId: 'entry' }],
    courses: [{ id: 'course' }],
    curriculumCourses: [{ id: 'cc1', curriculumId: 'chart', courseId: 'course' }],
    academicRules: [],
    courseOfferings: [{ id: 'off1', courseId: 'course', campusId: 'camp', termId: 'term' }],
    academicSettings: { normalMinUnits: 12, normalMaxUnits: 20 },
    studentProfiles: [{ userId: 'u1', universityId: 'u', campusId: 'camp', degreeLevelId: 'deg', majorId: 'major', entryYearId: 'entry', currentTermId: 'term' }],
    studentPassedCourses: [{ id: 'p1', userId: 'u1', courseId: 'course' }],
    studentPlans: [{ id: 'plan', userId: 'u1', termId: 'term', selectedOfferingIds: ['off1'] }],
    demandSurveys: [{ id: 'survey', courseIds: ['course'], targetTermId: 'term', majorId: 'major' }],
    demandResponses: [{ id: 'response', userId: 'u1', courseIds: ['course'] }],
    importBatches: [],
    importRecords: [],
    supportTickets: [{ id: 'support' }],
    supportMessages: [],
    bugReports: [],
    auditLogs: [{ id: 'audit' }],
    errorLogs: [],
    otpChallenges: [{ id: 'secret-otp' }],
    captchaChallenges: [{ id: 'secret-image' }],
    smsSettings: { apiKey: 'secret-provider-key' },
    smsHistory: [{ id: 'private-sms' }],
    syncJobs: [{ id: 'existing-sync' }],
    syncSnapshots: [],
  } as unknown as DatabaseSchema;
}

function uploaded(current: DatabaseSchema) {
  return {
    ...structuredClone(current),
    courses: [{ id: 'course' }, { id: 'new-course' }],
    users: [{ id: 'u1', password: 'evil-replacement', sessionVersion: 0 }],
    studentPlans: [],
    studentProfiles: [],
    studentPassedCourses: [],
    demandResponses: [],
    otpChallenges: [{ id: 'imported-otp' }],
    captchaChallenges: [{ id: 'imported-captcha' }],
    smsSettings: { apiKey: 'imported-private-key' },
    auditLogs: [],
    academicSettings: { normalMinUnits: 99, normalMaxUnits: 100 },
  };
}

describe('P0 catalogue backup restore must protect live student data', () => {
  it('restores validated academic catalogue while retaining students, queues, sessions, audit and secrets', () => {
    const current = fixture();
    const source = uploaded(current);
    const next = prepareCatalogRestore(current, source);
    expect(next.courses.map(x => x.id)).toEqual(['course', 'new-course']);
    expect(next.users).toBe(current.users);
    expect(next.studentPlans).toBe(current.studentPlans);
    expect(next.studentProfiles).toBe(current.studentProfiles);
    expect(next.studentPassedCourses).toBe(current.studentPassedCourses);
    expect(next.demandResponses).toBe(current.demandResponses);
    expect(next.auditLogs).toBe(current.auditLogs);
    expect(next.smsSettings).toBe(current.smsSettings);
    expect(next.smsHistory).toBe(current.smsHistory);
    expect(next.otpChallenges).toBe(current.otpChallenges);
    expect(next.captchaChallenges).toBe(current.captchaChallenges);
    expect(next.syncJobs).toBe(current.syncJobs);
    expect(next.academicSettings).toBe(current.academicSettings);
    expect(current.courses).toHaveLength(1);
    source.courses[0].id = 'mutated-after-upload';
    expect(next.courses[0].id).toBe('course');
  });

  it('rejects malformed, partial and duplicate-ID uploads without altering the live data', () => {
    const current = fixture();
    for (const incoming of [
      undefined, null, 'bad', [], {},
      { courses: [] },
      { ...uploaded(current), courses: 'invalid' },
      { ...uploaded(current), courses: [{ id: 'course' }, { id: 'course' }] },
      { ...uploaded(current), courses: [{ id: '' }] },
      { ...uploaded(current), academicRules: [null] },
      { ...uploaded(current), academicSettings: [] },
    ]) {
      expect(() => prepareCatalogRestore(current, incoming)).toThrow(InvalidCatalogBackupError);
    }
    expect(current.courses).toHaveLength(1);
    expect(current.studentPlans?.[0].selectedOfferingIds).toEqual(['off1']);
  });

  it('refuses a catalogue that would orphan a live plan, passed course, profile or survey', () => {
    const current = fixture();
    for (const incoming of [
      { ...uploaded(current), courseOfferings: [] },
      { ...uploaded(current), courses: [{ id: 'other' }] },
      { ...uploaded(current), campuses: [{ id: 'foreign-campus' }] },
      { ...uploaded(current), academicTerms: [{ id: 'other-term' }] },
      { ...uploaded(current), curriculumCourses: [{ id: 'bad', courseId: 'missing', curriculumId: 'chart' }] },
      { ...uploaded(current), curricula: [{ id: 'chart', universityId: 'missing', campusId: 'camp', degreeLevelId: 'deg', majorId: 'major', entryYearId: 'entry' }] },
      { ...uploaded(current), academicRules: [{ id: 'r1', curriculumId: 'chart', targetCourseId: 'missing' }] },
    ]) {
      expect(() => prepareCatalogRestore(current, incoming)).toThrow(InvalidCatalogBackupError);
    }
  });

  it('rolls back in-memory state and leaves existing bytes intact if rename fails', async () => {
    const dir = temporary();
    vi.stubEnv('DARSCHYN_DATA_DIR', dir);
    vi.resetModules();
    const { LocalDatabase } = await import('../server/db/database');
    const instance = new LocalDatabase();
    instance.data = fixture();
    instance.save();
    const oldData = instance.data;
    const dbPath = path.join(dir, 'darschyn-db.json');
    const original = fs.readFileSync(dbPath);

    const spy = vi.spyOn(fs, 'renameSync').mockImplementationOnce(() => {
      throw new Error('simulated rename failure');
    });
    expect(() => instance.importBackup(uploaded(instance.data))).toThrow('simulated rename failure');
    spy.mockRestore();
    expect(instance.data).toBe(oldData);
    expect(fs.readFileSync(dbPath)).toEqual(original);
    expect(fs.readdirSync(dir)).toEqual(['darschyn-db.json']);
  });

  it('keeps memory aligned with the already-renamed file when directory fsync fails late', async () => {
    const dir = temporary();
    vi.stubEnv('DARSCHYN_DATA_DIR', dir);
    vi.resetModules();
    const { LocalDatabase } = await import('../server/db/database');
    const instance = new LocalDatabase();
    instance.data = fixture();
    instance.save();
    const dbPath = path.join(dir, 'darschyn-db.json');
    let calls = 0;
    const realFsync = fs.fsyncSync;
    const spy = vi.spyOn(fs, 'fsyncSync').mockImplementation(fd => {
      calls += 1;
      if (calls === 2) throw new Error('simulated directory sync failure');
      return realFsync(fd);
    });
    expect(() => instance.importBackup(uploaded(instance.data))).toThrow('directory sync failure');
    spy.mockRestore();
    expect(instance.data.courses.map(x => x.id)).toEqual(['course', 'new-course']);
    expect(instance.data.studentPlans?.[0].selectedOfferingIds).toEqual(['off1']);
    expect(JSON.parse(fs.readFileSync(dbPath, 'utf8')).courses).toEqual(instance.data.courses);
  });

  it('does not export provider credentials or transient OTP state in admin backups', async () => {
    const dir = temporary();
    vi.stubEnv('DARSCHYN_DATA_DIR', dir);
    vi.resetModules();
    const { LocalDatabase } = await import('../server/db/database');
    const instance = new LocalDatabase();
    instance.data = fixture();
    const backup = instance.exportBackup();
    expect(backup.users[0].password).toBeUndefined();
    expect(backup.users[0].recoveryKey).toBeUndefined();
    expect(backup.smsSettings).toBeUndefined();
    expect(backup.smsHistory).toEqual([]);
    expect(backup.otpChallenges).toEqual([]);
    expect(backup.captchaChallenges).toEqual([]);
    expect(instance.data.smsSettings).toMatchObject({ apiKey: 'secret-provider-key' });
  });
});
