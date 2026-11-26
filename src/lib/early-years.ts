/** The reference assessment contains exactly these three descriptive remarks. */
export const EARLY_YEARS_REMARKS = ["EXCELLENT", "VERY GOOD", "GOOD"] as const;
export type EarlyYearsRemark = typeof EARLY_YEARS_REMARKS[number];
export function isEarlyYearsClass(name: string): boolean {
  return /^(?:creche|nursery)(?:[\s-]*(?:[1-3]|i{1,3}))?(?:\s+[a-z])?$/i.test(name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim());
}
export function earlyYearsRemark(value: unknown): EarlyYearsRemark | null {
  return EARLY_YEARS_REMARKS.find(remark => remark === value) ?? null;
}
