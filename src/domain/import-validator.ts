// ============================================================================
// DARSCHYN (درس‌چین) - Extension Import Validator & Course Matching Engine
// ============================================================================

import {
  Course,
  CourseOffering,
  ExtensionExportPayload,
  ImportRecord,
  RawExtractedOffering,
} from '../types';

export interface ImportValidationResult {
  isValid: boolean;
  errors: string[];
  totalRecords: number;
  matchedCount: number;
  reviewCount: number;
  invalidCount: number;
  importRecords: ImportRecord[];
  preparedOfferings: Omit<CourseOffering, 'id'>[];
}

/**
 * Normalizes Persian/Arabic digits to English digits and strips whitespace/punctuation.
 */
export function normalizeCode(code: string | undefined | null): string {
  if (!code) return '';
  const persianDigits = ['۰', '۱', '۲', '۳', '۴', '۵', '۶', '۷', '۸', '۹'];
  const arabicDigits = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

  let normalized = code.toString().trim();
  for (let i = 0; i < 10; i++) {
    normalized = normalized
      .replaceAll(persianDigits[i], i.toString())
      .replaceAll(arabicDigits[i], i.toString());
  }

  // Remove common separators like dashes, slashes, spaces
  return normalized.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
}

/**
 * Normalizes Persian string for consistent matching (Yeh/Kaf/half-space unification).
 */
export function normalizePersianText(text: string | undefined | null): string {
  if (!text) return '';
  return text
    .toString()
    .trim()
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/[\u200B-\u200D\uFEFF]/g, '') // Remove zero-width characters
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/**
 * Parses raw text (CSV, TSV, or JSON) into structured offering objects
 */
export function parseRawInput(rawContent: any): RawExtractedOffering[] {
  if (!rawContent) return [];

  // If already an array
  if (Array.isArray(rawContent)) {
    return rawContent.map(normalizeRawRecord).filter(Boolean) as RawExtractedOffering[];
  }

  // If already an object with records/courses/offerings/data
  if (typeof rawContent === 'object') {
    const list =
      rawContent.records ||
      rawContent.courses ||
      rawContent.offerings ||
      rawContent.data ||
      rawContent.items ||
      [];
    if (Array.isArray(list)) {
      return list.map(normalizeRawRecord).filter(Boolean) as RawExtractedOffering[];
    }
  }

  // If it's a string, try JSON parse first
  if (typeof rawContent === 'string') {
    const trimmed = rawContent.trim();
    if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
      try {
        const parsed = JSON.parse(trimmed);
        return parseRawInput(parsed);
      } catch (err) {
        // Fallthrough to CSV/TSV parsing
      }
    }

    // Parse CSV / TSV / line by line text
    const lines = trimmed.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return [];

    const delimiter = lines[0].includes('\t') ? '\t' : lines[0].includes(',') ? ',' : ';';
    const rows = lines.map((line) => line.split(delimiter).map((c) => c.trim().replace(/^["']|["']$/g, '')));

    if (rows.length === 0) return [];

    // Check if first row is header
    const firstRow = rows[0];
    const hasHeader = firstRow.some((col) =>
      ['کد', 'نام', 'درس', 'گروه', 'استاد', 'روز', 'ساعت', 'code', 'name', 'course'].some((k) =>
        col.includes(k)
      )
    );

    const headerIndexMap: Record<string, number> = {};
    if (hasHeader) {
      firstRow.forEach((col, idx) => {
        const norm = col.replace(/\s+/g, '').toLowerCase();
        if (norm.includes('کد') || norm.includes('code')) headerIndexMap['code'] = idx;
        if (norm.includes('نام') || norm.includes('عنوان') || norm.includes('name')) headerIndexMap['name'] = idx;
        if (norm.includes('گروه') || norm.includes('group')) headerIndexMap['group'] = idx;
        if (norm.includes('استاد') || norm.includes('مدرس') || norm.includes('teacher')) headerIndexMap['instructor'] = idx;
        if (norm.includes('روز') || norm.includes('day')) headerIndexMap['day'] = idx;
        if (norm.includes('ساعت') || norm.includes('زمان') || norm.includes('time')) headerIndexMap['time'] = idx;
        if (norm.includes('ظرفیت') || norm.includes('capacity')) headerIndexMap['capacity'] = idx;
      });
    }

    const dataRows = hasHeader ? rows.slice(1) : rows;
    return dataRows
      .map((row) => {
        if (row.length < 2) return null;
        let code = '';
        let name = '';
        let group = '';
        let instructor = '';
        let day = '';
        const startTime = '';
        const endTime = '';

        if (hasHeader && headerIndexMap['name'] !== undefined) {
          name = row[headerIndexMap['name']] || '';
          code = headerIndexMap['code'] !== undefined ? row[headerIndexMap['code']] || '' : '';
          group = headerIndexMap['group'] !== undefined ? row[headerIndexMap['group']] || '' : '';
          instructor = headerIndexMap['instructor'] !== undefined ? row[headerIndexMap['instructor']] || '' : '';
          day = headerIndexMap['day'] !== undefined ? row[headerIndexMap['day']] || '' : '';
        } else {
          // Assume columns: Code, Name, Group, Instructor, Day, Time
          code = row[0] || '';
          name = row[1] || '';
          group = row[2] || '';
          instructor = row[3] || '';
          day = row[4] || '';
        }

        if (!name && !code) return null;
        return {
          courseCode: code,
          courseName: name || code,
          group,
          instructor,
          day,
          startTime,
          endTime,
        } as RawExtractedOffering;
      })
      .filter(Boolean) as RawExtractedOffering[];
  }

  return [];
}

function normalizeRawRecord(raw: any): RawExtractedOffering | null {
  if (!raw || typeof raw !== 'object') return null;

  const code =
    raw.courseCode ||
    raw.code ||
    raw['کد درس'] ||
    raw['کد'] ||
    raw['شماره درس'] ||
    raw.course_code ||
    '';

  const name =
    raw.courseName ||
    raw.name ||
    raw['نام درس'] ||
    raw['عنوان'] ||
    raw['نام'] ||
    raw.course_name ||
    '';

  const group =
    raw.group ||
    raw.groupCode ||
    raw['گروه'] ||
    raw['گروه ارائه'] ||
    raw['گروه ارایه'] ||
    raw.group_code ||
    '';

  const instructor =
    raw.instructor ||
    raw.teacher ||
    raw['استاد'] ||
    raw['نام استاد'] ||
    raw['مدرس'] ||
    '';

  const day =
    raw.day ||
    raw.dayOfWeek ||
    raw['روز'] ||
    raw['روز برگزاری'] ||
    raw['روز هفته'] ||
    '';

  const startTime =
    raw.startTime ||
    raw.start ||
    raw['ساعت شروع'] ||
    raw['شروع'] ||
    '';

  const endTime =
    raw.endTime ||
    raw.end ||
    raw['ساعت پایان'] ||
    raw['پایان'] ||
    '';

  const units = raw.units ?? raw.unit ?? raw['واحد'] ?? raw['تعداد واحد'];
  const capacity = raw.capacity ?? raw['ظرفیت'];
  const availableCapacity = raw.availableCapacity ?? raw['ظرفیت باقیمانده'] ?? raw['مانده'];
  const location = raw.location || raw['مکان'] || raw['کلاس'] || raw['محل'] || undefined;
  const examDate = raw.examDate || raw['تاریخ امتحان'] || raw['امتحان'] || undefined;

  return {
    courseCode: code.toString().trim(),
    courseName: name.toString().trim(),
    group: group.toString().trim(),
    instructor: instructor.toString().trim(),
    units: Number(units) || 3,
    day: day.toString().trim(),
    startTime: startTime.toString().trim(),
    endTime: endTime.toString().trim(),
    capacity: Number(capacity) || 35,
    availableCapacity: Number(availableCapacity) || 10,
    location: location.toString().trim(),
    examDate: examDate ? examDate.toString().trim() : undefined,
  };
}

/**
 * Validates and matches raw extracted records from Chrome Extension or Upload against database courses.
 */
export function processImportPayload(
  payload: any,
  batchId: string,
  termId: string,
  campusId: string,
  existingCourses: Course[]
): ImportValidationResult {
  const errors: string[] = [];

  const rawRecords = parseRawInput(payload);

  if (rawRecords.length === 0) {
    errors.push('هیچ رکورد درسی در فایل واردشده یافت نشد یا فرمت فایل غیرقابل تشخیص است.');
    return {
      isValid: false,
      errors,
      totalRecords: 0,
      matchedCount: 0,
      reviewCount: 0,
      invalidCount: 0,
      importRecords: [],
      preparedOfferings: [],
    };
  }

  // Build lookup maps for fast matching (including multi-code support)
  const exactCodeMap = new Map<string, Course>();
  const normalizedCodeMap = new Map<string, Course>();
  const normalizedNameMap = new Map<string, Course>();

  for (const c of existingCourses) {
    if (c.code) {
      exactCodeMap.set(c.code.trim(), c);
      normalizedCodeMap.set(normalizeCode(c.code), c);
    }
    // Register alternate codes
    if (c.alternateCodes && Array.isArray(c.alternateCodes)) {
      for (const alt of c.alternateCodes) {
        if (alt && alt.trim()) {
          exactCodeMap.set(alt.trim(), c);
          normalizedCodeMap.set(normalizeCode(alt), c);
        }
      }
    }
    // Register structured courseCodes
    if (c.courseCodes && Array.isArray(c.courseCodes)) {
      for (const cc of c.courseCodes) {
        if (cc.code && cc.code.trim()) {
          exactCodeMap.set(cc.code.trim(), c);
          normalizedCodeMap.set(normalizeCode(cc.code), c);
        }
      }
    }
    if (c.name) {
      normalizedNameMap.set(normalizePersianText(c.name), c);
    }
  }

  const importRecords: ImportRecord[] = [];
  const preparedOfferings: Omit<CourseOffering, 'id'>[] = [];

  let matchedCount = 0;
  let reviewCount = 0;
  let invalidCount = 0;

  const seenGroupSet = new Set<string>();

  rawRecords.forEach((raw: RawExtractedOffering, index: number) => {
    const recordId = `rec-${batchId}-${index + 1}`;

    // 1. Basic sanity checks
    if (!raw.courseName || raw.courseName.trim() === '') {
      importRecords.push({
        id: recordId,
        batchId,
        rawData: raw,
        matchedCourseId: null,
        status: 'INVALID',
        reviewReason: 'نام درس در این سطر خالی است.',
      });
      invalidCount++;
      return;
    }

    // 2. Matching logic priority
    let matchedCourse: Course | undefined;
    let matchMethod = '';

    // Priority 1: Exact code match
    if (raw.courseCode && exactCodeMap.has(raw.courseCode.trim())) {
      matchedCourse = exactCodeMap.get(raw.courseCode.trim());
      matchMethod = 'تطبیق دقیق بر اساس کد درس';
    }
    // Priority 2: Normalized code match
    else if (raw.courseCode && normalizedCodeMap.has(normalizeCode(raw.courseCode))) {
      matchedCourse = normalizedCodeMap.get(normalizeCode(raw.courseCode));
      matchMethod = 'تطبیق بر اساس کد استانداردسازی‌شده';
    }
    // Priority 3: Normalized course name match
    else if (raw.courseName && normalizedNameMap.has(normalizePersianText(raw.courseName))) {
      matchedCourse = normalizedNameMap.get(normalizePersianText(raw.courseName));
      matchMethod = 'تطبیق بر اساس عنوان درس';
    } else {
      // Priority 4: Fuzzy partial name match
      const normInput = normalizePersianText(raw.courseName);
      matchedCourse = existingCourses.find((c) => {
        const normExisting = normalizePersianText(c.name);
        return (
          normExisting.includes(normInput) ||
          normInput.includes(normExisting) ||
          (normInput.length > 5 && normExisting.slice(0, 5) === normInput.slice(0, 5))
        );
      });
      if (matchedCourse) {
        matchMethod = 'تطبیق تقریبی بر اساس نام درس چارت';
      }
    }

    if (!matchedCourse) {
      importRecords.push({
        id: recordId,
        batchId,
        rawData: raw,
        matchedCourseId: null,
        status: 'NEEDS_REVIEW',
        reviewReason: `درسی با کد «${raw.courseCode || 'ندارد'}» و نام «${raw.courseName}» در چارت دروس سامانه یافت نشد.`,
      });
      reviewCount++;
      return;
    }

    // Check duplicate in same batch (same course + group)
    const groupKey = `${matchedCourse.id}-${raw.group || '01'}`;
    if (seenGroupSet.has(groupKey)) {
      importRecords.push({
        id: recordId,
        batchId,
        rawData: raw,
        matchedCourseId: matchedCourse.id,
        status: 'NEEDS_REVIEW',
        reviewReason: `گروه تکراری «${raw.group || '01'}» برای درس «${matchedCourse.name}» در این فایل وجود دارد.`,
      });
      reviewCount++;
      return;
    }
    seenGroupSet.add(groupKey);

    importRecords.push({
      id: recordId,
      batchId,
      rawData: raw,
      matchedCourseId: matchedCourse.id,
      status: 'MATCHED',
      reviewReason: matchMethod,
    });
    matchedCount++;

    preparedOfferings.push({
      termId,
      campusId,
      courseId: matchedCourse.id,
      rawCourseCode: raw.courseCode || matchedCourse.code,
      rawCourseName: raw.courseName,
      groupCode: raw.group || '01',
      instructor: raw.instructor || 'اساتید گروه آموزشی',
      dayOfWeek: raw.day || 'شنبه',
      startTime: raw.startTime || '۰۸:۰۰',
      endTime: raw.endTime || '۱۰:۰۰',
      location: raw.location || 'دانشکده فنی و مهندسی',
      capacity: raw.capacity || 35,
      enrolledCount: raw.capacity ? Math.max(0, (raw.capacity || 35) - (raw.availableCapacity || 0)) : 10,
      examDate: raw.examDate || undefined,
      notes: raw.status || undefined,
      source: 'extension',
      active: true,
    });
  });

  return {
    isValid: errors.length === 0 && matchedCount > 0,
    errors,
    totalRecords: rawRecords.length,
    matchedCount,
    reviewCount,
    invalidCount,
    importRecords,
    preparedOfferings,
  };
}
