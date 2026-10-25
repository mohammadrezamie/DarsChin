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
        const norm = normalizePersianText(col).replace(/\s+/g, '');
        // نام درس ends with "مدرس" after spaces are removed; prioritize this
        // exact header before matching the instructor keyword "مدرس".
        if (/^(نامدرس|عنواندرس|coursename|coursetitle)$/.test(norm)) headerIndexMap.name = idx;
        else if (/ظرفیت(باقیمانده|باقی|مانده)|availablecapacity|remaining/.test(norm)) headerIndexMap.available = idx;
        else if (/ظرفیت|capacity/.test(norm)) headerIndexMap.capacity = idx;
        else if (/ساعتشروع|زمانشروع|starttime|start/.test(norm)) headerIndexMap.start = idx;
        else if (/ساعتپایان|زمانپایان|endtime|end/.test(norm)) headerIndexMap.end = idx;
        else if (/ساعت|زمان|time/.test(norm)) headerIndexMap.time = idx;
        else if (/استاد|مدرس|teacher|instructor/.test(norm)) headerIndexMap.instructor = idx;
        else if (/گروه|group/.test(norm)) headerIndexMap.group = idx;
        else if (/روز|day/.test(norm)) headerIndexMap.day = idx;
        else if (/کد|code/.test(norm)) headerIndexMap.code = idx;
        else if (/نام|عنوان|درس|name|course/.test(norm)) headerIndexMap.name = idx;
      });
    }
    const normalizeNumeral = (value: string): string => value
      .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
      .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
    const optionalNumber = (value: string | undefined): number | undefined => {
      if (!value?.trim()) return undefined;
      const parsed = Number(normalizeNumeral(value.trim()));
      return Number.isFinite(parsed) ? parsed : undefined;
    };

    const dataRows = hasHeader ? rows.slice(1) : rows;
    return dataRows
      .map((row) => {
        if (row.length < 2) return null;
        const field = (key: string): string => {
          const index = headerIndexMap[key];
          return index === undefined ? '' : (row[index] || '');
        };
        const code = hasHeader ? field('code') : (row[0] || '');
        const name = hasHeader ? field('name') : (row[1] || '');
        if (!code && !name) return null;
        // Preserve the exact source digits in the raw preview; normalization to
        // ASCII happens later when publishing a validated offering.
        const timeRange = hasHeader ? field('time') : (row[5] || '');
        const range = /([0-9۰-۹٠-٩]{1,2}:[0-9۰-۹٠-٩]{2})\s*[-–—]\s*([0-9۰-۹٠-٩]{1,2}:[0-9۰-۹٠-٩]{2})/.exec(timeRange);
        return {
          courseCode: code,
          courseName: name || code,
          group: hasHeader ? field('group') : (row[2] || ''),
          instructor: hasHeader ? field('instructor') : (row[3] || ''),
          day: hasHeader ? field('day') : (row[4] || ''),
          startTime: hasHeader ? (field('start') || range?.[1] || '') : (range?.[1] || ''),
          endTime: hasHeader ? (field('end') || range?.[2] || '') : (range?.[2] || ''),
          capacity: hasHeader ? optionalNumber(field('capacity')) : optionalNumber(row[6]),
          availableCapacity: hasHeader ? optionalNumber(field('available')) : optionalNumber(row[7]),
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

  const explicitNumber = (value: unknown): number | undefined => {
    if (value === null || value === undefined || String(value).trim() === '') return undefined;
    const normalized = String(value)
      .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
      .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
    const num = Number(normalized);
    return Number.isFinite(num) ? num : undefined;
  };
  return {
    courseCode: String(code).trim(),
    courseName: String(name).trim(),
    group: String(group).trim(),
    instructor: String(instructor).trim(),
    units: explicitNumber(units),
    day: String(day).trim(),
    startTime: String(startTime).trim(),
    endTime: String(endTime).trim(),
    capacity: explicitNumber(capacity),
    availableCapacity: explicitNumber(availableCapacity),
    location: location === undefined ? undefined : String(location).trim(),
    examDate: examDate === undefined ? undefined : String(examDate).trim(),
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

  // A course code may be reused or collide across curricula. Never let the
  // last catalog record silently overwrite an earlier code or name.
  const codeMap = new Map<string, Set<string>>();
  const nameMap = new Map<string, Set<string>>();
  const byId = new Map(existingCourses.map(course => [course.id, course]));
  for (const course of existingCourses) {
    if (course.active === false) continue;
    const codes = [course.code, ...(course.alternateCodes ?? []), ...(course.courseCodes ?? [])
      // Cohort/major/track aliases cannot be trusted without the verified
      // program context. They remain review candidates, not automatic links.
      .filter(item => item.active !== false &&
        item.entryYear === undefined && !item.majorId && !item.trackId)
      .map(item => item.code)];
    for (const code of codes) {
      const key = normalizeCode(code);
      if (!key) continue;
      const ids = codeMap.get(key) ?? new Set<string>();
      ids.add(course.id);
      codeMap.set(key, ids);
    }
    const normalizedName = normalizePersianText(course.name);
    if (normalizedName) {
      const ids = nameMap.get(normalizedName) ?? new Set<string>();
      ids.add(course.id);
      nameMap.set(normalizedName, ids);
    }
  }

  const normalizedTime = (value: string | null | undefined): string | undefined => {
    if (!value) return undefined;
    const ascii = value.trim()
      .replace(/[۰-۹]/g, digit => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
      .replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)));
    const match = /^(\d{1,2}):(\d{2})$/.exec(ascii);
    if (!match) return undefined;
    const hours = Number(match[1]), minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) return undefined;
    return String(hours).padStart(2, '0') + ':' + match[2];
  };
  const validDays = new Set(['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه']);
  const canonicalDay = (value: string | null | undefined): string | undefined => {
    const plain = normalizePersianText(value).replace(/\s+/g, '');
    return [...validDays].find(day => normalizePersianText(day).replace(/\s+/g, '') === plain);
  };
  
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

    // Exact, unambiguous normalized code is the only automatic link.
    // A unique title without a code is a suggestion for manual review, not a match.
    const code = normalizeCode(raw.courseCode);
    const potentialIds = code ? codeMap.get(code) : nameMap.get(normalizePersianText(raw.courseName));
    const matchingIds = potentialIds ? [...potentialIds] : [];
    const matchedCourse = matchingIds.length === 1 ? byId.get(matchingIds[0]) : undefined;
    const markReview = (reason: string, suggestedCourseId?: string) => {
      importRecords.push({
        id: recordId,
        batchId,
        rawData: raw,
        matchedCourseId: suggestedCourseId ?? null,
        status: 'NEEDS_REVIEW',
        reviewReason: reason,
      });
      reviewCount++;
    };

    if (matchingIds.length > 1) {
      markReview('چند درس با همین کد یا نام وجود دارند؛ انتخاب خودکار ممنوع است.');
      return;
    }
    if (!matchedCourse) {
      markReview(`برای کد «${raw.courseCode || 'نامشخص'}» تطبیق یکتا وجود ندارد؛ شباهت نام مجوز انتخاب خودکار نیست.`);
      return;
    }
    if (!code) {
      markReview('کد درس در فایل نیست؛ تطبیق بر اساس عنوان نیازمند تأیید مدیر است.', matchedCourse.id);
      return;
    }
    if (normalizePersianText(raw.courseName) !== normalizePersianText(matchedCourse.name)) {
      markReview('کد درس پیدا شد اما نام منبع با نام ثبت‌شده یکسان نیست؛ تطبیق را بررسی کنید.', matchedCourse.id);
      return;
    }

    const day = canonicalDay(raw.day);
    const startTime = normalizedTime(raw.startTime);
    const endTime = normalizedTime(raw.endTime);
    const capacity = raw.capacity;
    const available = raw.availableCapacity;
    if (!raw.group?.trim() || !raw.instructor?.trim() || !day || !startTime || !endTime ||
        startTime >= endTime || typeof capacity !== 'number' ||
        !Number.isSafeInteger(capacity) || capacity < 1) {
      markReview('گروه، نام استاد، روز، زمان معتبر کلاس یا ظرفیت واقعی در داده منبع موجود نیست.', matchedCourse.id);
      return;
    }
    if (available !== undefined && available !== null &&
        (!Number.isSafeInteger(available) || available < 0 || available > capacity)) {
      markReview('ظرفیت باقیمانده با ظرفیت کل سازگار نیست.', matchedCourse.id);
      return;
    }
    const hasAvailable = typeof available === 'number';

    // Check duplicate in same batch (same course + group)
    const groupKey = `${matchedCourse.id}-${raw.group.trim()}`;
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
      reviewReason: 'کد یکتا، عنوان یکسان و اطلاعات واقعی گروه تأیید اولیه شدند؛ هنوز منتشر نشده است.',
    });
    matchedCount++;

    preparedOfferings.push({
      termId,
      campusId,
      courseId: matchedCourse.id,
      rawCourseCode: raw.courseCode || matchedCourse.code,
      rawCourseName: raw.courseName,
      groupCode: raw.group.trim(),
      instructor: raw.instructor!.trim(),
      dayOfWeek: day,
      startTime,
      endTime,
      location: raw.location || undefined,
      capacity,
      enrolledCount: hasAvailable ? capacity - available! : 0,
      enrolledCountKnown: hasAvailable,
      examDate: raw.examDate || undefined,
      notes: hasAvailable ? (raw.status || undefined) : 'ظرفیت باقیمانده در فایل منبع مشخص نشده است؛ تعداد ثبت‌نام‌شدگان نامعلوم است.',
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
