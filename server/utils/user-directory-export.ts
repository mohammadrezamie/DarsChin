import type { User, StudentAcademicProfile } from '../../src/types';

export type DirectoryRole = 'all' | 'student' | 'admin' | 'super-admin';
export type DirectoryVerified = 'all' | 'yes' | 'no';
export type DirectoryFilters = { role: DirectoryRole; verified: DirectoryVerified; search: string };

const normalizeDigits = (value: string): string => value.replace(/[۰-۹٠-٩]/g, character => {
  const point = character.charCodeAt(0);
  return String(point >= 0x6f0 && point <= 0x6f9 ? point - 0x6f0 : point - 0x660);
});

export function normalizeDirectorySearch(value: string): string {
  return normalizeDigits(value).trim().replace(/\s+/g, ' ').toLocaleLowerCase('fa');
}

export function isValidDirectoryFilters(raw: Record<string, unknown>): raw is DirectoryFilters {
  return ['all', 'student', 'admin', 'super-admin'].includes(String(raw.role)) &&
    ['all', 'yes', 'no'].includes(String(raw.verified)) &&
    typeof raw.search === 'string' && raw.search.length <= 120;
}

export type DirectoryRecord = {
  name: string;
  mobile: string;
  studentNumber: string;
  role: 'student' | 'admin' | 'super-admin';
  verified: boolean;
  status: 'active' | 'deactivated';
};

export function listDirectoryRecords(
  users: readonly User[],
  profiles: readonly StudentAcademicProfile[],
  filters: DirectoryFilters,
): DirectoryRecord[] {
  const profileByUserId = new Map(profiles.map(profile => [profile.userId, profile]));
  const search = normalizeDirectorySearch(filters.search);
  const records = users.map(user => {
    const role = user.roles?.includes('super-admin') ? 'super-admin' :
      user.roles?.includes('admin') ? 'admin' : 'student';
    const profile = profileByUserId.get(user.id);
    return {
      name: user.name,
      mobile: user.mobile,
      studentNumber: profile?.studentNumber || '',
      role,
      verified: Boolean(user.mobileVerifiedAt),
      status: user.deactivatedAt ? 'deactivated' : 'active',
    } as DirectoryRecord;
  });
  return records.filter(record => {
    if (filters.role !== 'all' && record.role !== filters.role) return false;
    if (filters.verified === 'yes' && !record.verified) return false;
    if (filters.verified === 'no' && record.verified) return false;
    if (!search) return true;
    return [record.name, record.mobile, record.studentNumber]
      .some(value => normalizeDirectorySearch(value).includes(search));
  }).sort((a, b) => a.name.localeCompare(b.name, 'fa') || a.mobile.localeCompare(b.mobile));
}

/** Protect Excel and spreadsheet importers against CSV formula injection. */
export function safeCsvCell(raw: string): string {
  const text = String(raw);
  const normalized = /^[\s\u200b-\u200f]*[=+\-@]/u.test(text) ? `'${text}` : text;
  return `"${normalized.replace(/"/g, '""')}"`;
}

export function createDirectoryCsv(records: readonly DirectoryRecord[]): string {
  const headers = ['نام کاربر', 'شماره موبایل', 'شماره دانشجویی', 'نقش', 'تأیید شماره', 'وضعیت حساب'];
  const roleLabel = { student: 'دانشجو', admin: 'مدیر', 'super-admin': 'مدیر ارشد' };
  const lines = records.map(record => [
    record.name, record.mobile, record.studentNumber,
    roleLabel[record.role], record.verified ? 'بله' : 'خیر',
    record.status === 'active' ? 'فعال' : 'غیرفعال',
  ].map(safeCsvCell).join(','));
  return '\uFEFF' + [headers.map(safeCsvCell).join(','), ...lines].join('\r\n') + '\r\n';
}
