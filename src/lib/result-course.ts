/** Only compare explicit course identifiers; missing labels are not proof of a mismatch. */
export function resultCourse(label: string | null | undefined): string | null {
  const tier = /\b(gold|silver|bronze)\b/i.exec(label ?? "")?.[1]?.toLowerCase();
  if (!tier) return null;
  return `${tier}${/e[\s-]?bike/i.test(label ?? "") ? "-ebike" : ""}`;
}

export function courseMismatch(entryClass: string | null, timingCourses: Iterable<string>): boolean {
  const expected = resultCourse(entryClass);
  if (!expected) return false;
  return [...timingCourses].some((course) => course !== expected);
}