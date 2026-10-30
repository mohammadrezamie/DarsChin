import type {
  AcademicRule, AcademicRuleNode, CourseEligibilityResult, StudentAcademicProfile,
  StudentPassedCourse,
} from '../types';

/**
 * Planning aid for the *manual* Educationalyar registration workflow.
 * Eligibility is still decided by the server and the university portal.
 * Enforces before-target sequencing ONLY for configured, scope-matching corequisites.
 */
export interface RegistrationStep {
  courseId: string;
  courseName: string;
  /** Code displayed by the catalog or actually seen on the imported offering. */
  copyCode: string | null;
  /** The code came from an offering import, not necessarily an official portal confirmation. */
  codeFromOffering: boolean;
  groupCode: string;
  offeringId: string;
  requestedRank: number;
  effectiveRank: number;
  advancedForCorequisite: boolean;
  dependencyNames: string[];
  dependencyCourseIds: string[];
  warnings: string[];
  ready: boolean;
}
export interface RegistrationQueue {
  steps: RegistrationStep[];
  hasCycle: boolean;
  hasUnresolvedRules: boolean;
}

type Choice = { prerequisites: string[]; missing: string[]; notes: string[] };

const successful = (row: StudentPassedCourse) =>
  row.status !== 'FAILED' && row.status !== 'ABSENT' &&
  (row.grade === undefined || Number(row.grade) >= 10);

/** Never arbitrarily enforce every operand of an OR expression. */
function resolveRequirement(
  node: AcademicRuleNode,
  passed: Set<string>,
  planned: Set<string>,
  names: Map<string, string>,
): Choice {
  if (node.type === 'COURSE') {
    const id = node.courseId;
    if (!id) return { prerequisites: [], missing: [], notes: ['قانون دارای شناسهٔ درس نامعتبر است.'] };
    if (passed.has(id)) return { prerequisites: [], missing: [], notes: [] };
    if (planned.has(id)) return { prerequisites: [id], missing: [], notes: [] };
    return { prerequisites: [], missing: [names.get(id) || id], notes: [] };
  }
  if (node.type !== 'GROUP' || !Array.isArray(node.operands) || node.operands.length === 0) {
    return { prerequisites: [], missing: [], notes: ['ساختار قانون باید توسط مدیر آموزش بررسی شود.'] };
  }
  const choices = node.operands.map(child => resolveRequirement(child, passed, planned, names));
  if (node.operator === 'AND') return {
    prerequisites: [...new Set(choices.flatMap(x => x.prerequisites))],
    missing: [...new Set(choices.flatMap(x => x.missing))],
    notes: choices.flatMap(x => x.notes),
  };
  if (node.operator === 'OR') {
    if (choices.some(x => x.prerequisites.length === 0 && x.missing.length === 0 && x.notes.length === 0)) {
      return { prerequisites: [], missing: [], notes: [] }; // already passed
    }
    const selectedChoices = choices.filter(x =>
      x.prerequisites.length > 0 && x.missing.length === 0 && x.notes.length === 0);
    if (selectedChoices.length === 1) return selectedChoices[0];
    if (selectedChoices.length > 1) return {
      ...selectedChoices[0],
      notes: ['قانون «یا»: یکی از همنیازهای انتخاب‌شده کافی است؛ مسیر انتخابی را بررسی کن.'],
    };
    return {
      prerequisites: [], missing: [],
      notes: ['همنیاز جایگزین (یا/OR) هنوز در برنامه تعیین نشده یا قانون مبهم است.'],
    };
  }
  return { prerequisites: [], missing: [], notes: ['عملگر رابطهٔ درسی نامعتبر است.'] };
}

export function buildRegistrationQueue(input: {
  evaluations: CourseEligibilityResult[];
  selectedOfferingIds: string[];
  preferredCourseIds: string[];
  rules: AcademicRule[];
  passedCourses: StudentPassedCourse[];
  profile: Pick<StudentAcademicProfile, 'majorId' | 'entryYearId' | 'selectedTrackId'>;
}): RegistrationQueue {
  const { evaluations, selectedOfferingIds, preferredCourseIds, rules, passedCourses, profile } = input;
  const selected = new Map<string, CourseEligibilityResult>();
  // Preserve explicitly selected groups, rather than advertising an unselected alternative.
  for (const id of selectedOfferingIds) {
    const offering = evaluations.find(e => e.offeringId === id);
    if (offering && !selected.has(offering.courseId)) selected.set(offering.courseId, offering);
  }
  const ranks = new Map(preferredCourseIds.map((id, i) => [id, i]));
  const requested = [...selected.keys()].sort((a,b) =>
    (ranks.get(a) ?? Number.MAX_SAFE_INTEGER) - (ranks.get(b) ?? Number.MAX_SAFE_INTEGER));
  const selectedSet = new Set(requested);
  const passed = new Set(passedCourses.filter(successful).map(x => x.courseId));
  const names = new Map(evaluations.map(row => [row.courseId, row.courseName]));
  const warnings = new Map(requested.map(id => [id, [] as string[]]));
  const dependencies = new Map(requested.map(id => [id, new Set<string>()]));
  const applicable = rules.filter(rule =>
    (!rule.majorId || rule.majorId === profile.majorId) &&
    (!rule.entryYearId || rule.entryYearId === profile.entryYearId) &&
    (!rule.trackId || rule.trackId === profile.selectedTrackId));
  const unresolved = { value: false };
  for (const rule of applicable) {
    if (!selectedSet.has(rule.targetCourseId)) continue;
    const target = rule.targetCourseId;
    if (rule.relationshipType === 'COREQUISITE') {
      const resolved = resolveRequirement(rule.expression, passed, selectedSet, names);
      resolved.prerequisites.forEach(id => { if (id !== target) dependencies.get(target)?.add(id); });
      const problem = [
        ...resolved.missing.map(name => `همنیاز «${name}» پاس نشده و در برنامه انتخاب نشده است.`),
        ...resolved.notes,
      ];
      if (problem.length) unresolved.value = true;
      warnings.get(target)?.push(...problem);
      if (resolved.prerequisites.includes(target)) {
        unresolved.value = true;
        warnings.get(target)?.push('قانون همنیاز به خود درس ارجاع می‌دهد؛ اصلاح قانون لازم است.');
      }
    } else if (rule.relationshipType === 'PREREQUISITE') {
      // Passing a prerequisite is an *academic* condition, not a sequencing shortcut.
      const resolved = resolveRequirement(rule.expression, passed, new Set(), names);
      if (resolved.missing.length || resolved.notes.length) {
        unresolved.value = true;
        warnings.get(target)?.push('پیش‌نیاز این درس نیاز به بررسی دارد؛ اخذ آن در همین ترم به‌تنهایی جای قبولی قبلی را نمی‌گیرد.');
        warnings.get(target)?.push(...resolved.notes);
      }
    }
  }
  // Stable Kahn topological ordering: user's preference wins wherever no edge exists.
  const ordered: string[] = [];
  const remaining = new Set(requested);
  while (remaining.size) {
    const next = requested.find(id => remaining.has(id) &&
      [...(dependencies.get(id) || [])].every(parent => !remaining.has(parent)));
    if (!next) break;
    ordered.push(next);
    remaining.delete(next);
  }
  const hasCycle = remaining.size > 0;
  if (hasCycle) {
    unresolved.value = true;
    for (const id of remaining) warnings.get(id)?.push('چرخه در وابستگی همنیازها وجود دارد؛ ترتیب ایمن قابل محاسبه نیست.');
    ordered.push(...requested.filter(id => remaining.has(id))); // no silent loss
  }
  const steps = ordered.map((id, index): RegistrationStep => {
    const o = selected.get(id)!;
    const explicit = typeof o.rawCourseCode === 'string' ? o.rawCourseCode.trim() : '';
    const catalog = typeof o.courseCode === 'string' ? o.courseCode.trim() : '';
    const code = explicit || (catalog && catalog !== '---' ? catalog : '');
    const problems = [...(warnings.get(id) || [])];
    // A code is not permission to select an ineligible offering. Honor the
    // evaluated eligibility report rather than inventing academic exceptions.
    const blocked = !o.canSelect || !o.isEligible || o.overallStatus !== 'AVAILABLE';
    if (blocked) {
      unresolved.value = true;
      problems.push(`این گروه در گزارش فعلی قابل اخذ نیست: ${o.primaryReason || 'نیازمند بررسی شرایط آموزشی است.'}`);
    }
    if (!explicit) {
      unresolved.value = true;
      problems.push('کد از کاتالوگ/تطبیق درس آمده و برای ثبت در آموزشیار تأیید نشده؛ قبل از جست‌وجو کد ارائه را کنترل کن.');
    }
    if (!code) {
      unresolved.value = true;
      problems.push('کد این درس نامشخص است؛ ابتدا کد رسمی ارائه را تأیید کن.');
    }
    // A synthetic demo code is visible as a sample only; it cannot be a
    // quick-registration action in the real Educationalyar portal.
    if (/^DEMO[-_]/i.test(code)) {
      unresolved.value = true;
      problems.push('این کد نمایشی DEMO است و برای ثبت واقعی در آموزشیار معتبر نیست.');
    }
    const requestedRank = requested.indexOf(id) + 1;
    return {
      courseId: id, courseName: o.courseName,
      copyCode: code || null, codeFromOffering: Boolean(explicit),
      groupCode: o.groupCode, offeringId: o.offeringId, requestedRank,
      effectiveRank: index + 1, advancedForCorequisite: index + 1 !== requestedRank,
      dependencyNames: [...(dependencies.get(id) || [])].map(dep => names.get(dep) || dep),
      dependencyCourseIds: [...(dependencies.get(id) || [])],
      warnings: [...new Set(problems)],
      ready: !hasCycle && !blocked && Boolean(explicit) && !problems.length,
    };
  });
  return { steps, hasCycle, hasUnresolvedRules: unresolved.value };
}
