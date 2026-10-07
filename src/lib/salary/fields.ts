/**
 * @file The Salary Payments module's fixed ("core") fields and template
 * types. Core fields are typed columns on salary_lines
 * (0031_salary_payments.sql - keep in sync); anything else in an
 * employer's muster roll is mapped to "other deduction" / "other earning"
 * and stored under its own header, or ignored.
 */

export type SalaryCoreField =
  | "staff_no"
  | "employee_name"
  | "basic_pay"
  | "commuter_allowance"
  | "house_allowance"
  | "gross_pay"
  | "housing_levy"
  | "nssf"
  | "shif"
  | "paye"
  | "total_statutory"
  | "total_other_deductions"
  | "net_pay"
  | "employer_housing_levy"
  | "employer_nita"
  | "employer_nssf";

export type SalaryColumnKind = "core" | "other_deduction" | "other_earning" | "ignore";

/** One column of a saved template - matched to an uploaded file's headers
 * by normalizeHeader(). */
export type SalaryTemplateColumn = {
  header: string;
  kind: SalaryColumnKind;
  field?: SalaryCoreField;
  /** other_deduction / other_earning only: the name the amount is stored
   * and shown under (e.g. "SACCO" for "Sacco Deductions"). Defaults to the
   * header. Columns sharing a name are added together, so a deduction
   * whose header changes between months stays one line. */
  name?: string;
};

/** The name an other deduction/earning column's amount is stored under. */
export function storedName(c: SalaryTemplateColumn): string {
  return c.name?.trim() || c.header;
}

export type SalaryTemplate = {
  id: string;
  employerId: string;
  version: number;
  columns: SalaryTemplateColumn[];
  totalsMarker: string;
  sampleFileName: string | null;
  notes: string | null;
  createdAt: string;
};

export const SALARY_CORE_FIELDS: { key: SalaryCoreField; label: string; required?: boolean; text?: boolean; group: string }[] = [
  { key: "staff_no", label: "Staff No", required: true, text: true, group: "Employee" },
  { key: "employee_name", label: "Employee Name", required: true, text: true, group: "Employee" },
  { key: "basic_pay", label: "Basic Pay", group: "Earnings" },
  { key: "commuter_allowance", label: "Commuter Allowance", group: "Earnings" },
  { key: "house_allowance", label: "House Allowance", group: "Earnings" },
  { key: "gross_pay", label: "Gross Pay", required: true, group: "Earnings" },
  { key: "housing_levy", label: "Housing Levy", group: "Statutory deductions" },
  { key: "nssf", label: "NSSF", group: "Statutory deductions" },
  { key: "shif", label: "SHIF", group: "Statutory deductions" },
  { key: "paye", label: "PAYE", group: "Statutory deductions" },
  { key: "total_statutory", label: "Total Statutory", group: "Statutory deductions" },
  { key: "total_other_deductions", label: "Total Other Deductions", group: "Other deductions" },
  { key: "net_pay", label: "Net Pay", required: true, group: "Net" },
  { key: "employer_housing_levy", label: "Housing Levy (Employer)", group: "Employer contributions" },
  { key: "employer_nita", label: "NITA (Employer)", group: "Employer contributions" },
  { key: "employer_nssf", label: "NSSF (Employer)", group: "Employer contributions" },
];

export const SALARY_FIELD_LABEL: Record<SalaryCoreField, string> = Object.fromEntries(
  SALARY_CORE_FIELDS.map((f) => [f.key, f.label])
) as Record<SalaryCoreField, string>;

export const REQUIRED_SALARY_FIELDS: SalaryCoreField[] = SALARY_CORE_FIELDS.filter((f) => f.required).map((f) => f.key);

/** Ordered: the first matching pattern wins, and employer-contribution
 * patterns come before the employee ones they'd otherwise also match
 * ("Housing Levy Employers Cont." vs "Housing Levy"). Tested against
 * normalizeHeader() output. */
export const SALARY_HEADER_GUESSES: [SalaryCoreField, RegExp][] = [
  ["employer_housing_levy", /housing levy.*employer|employer.*housing levy/],
  ["employer_nssf", /n\.?s\.?s\.?f.*employer|employer.*n\.?s\.?s\.?f/],
  ["employer_nita", /n\.?i\.?t\.?a/],
  ["staff_no", /^(staff|employee|payroll|personal)\s*(no|number|#|id)\.?$|^pf\s*no/],
  ["employee_name", /^(employee|staff|full)?\s*names?$/],
  ["basic_pay", /^basic/],
  ["commuter_allowance", /commuter|transport allowance/],
  ["house_allowance", /^hous(e|ing) allowance/],
  ["gross_pay", /^gross/],
  ["total_statutory", /^total statutory/],
  ["total_other_deductions", /^total other/],
  ["housing_levy", /^housing levy$/],
  ["nssf", /^n\.?s\.?s\.?f\.?$/],
  ["shif", /^s\.?h\.?i\.?f\.?$|^n\.?h\.?i\.?f\.?$/],
  ["paye", /^p\.?a\.?y\.?e\.?|^income tax/],
  ["net_pay", /^net (pay|salary)/],
];

/** Lowercased, trimmed, single-spaced - so "PAYE  (Tax) " and "paye (tax)"
 * are the same column. */
export function normalizeHeader(h: unknown): string {
  return String(h ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

export function guessCoreField(header: string): SalaryCoreField | undefined {
  const n = normalizeHeader(header);
  if (!n) return undefined;
  return SALARY_HEADER_GUESSES.find(([, re]) => re.test(n))?.[0];
}

/** A first-guess classification for a column with no template yet. Unknown
 * amount columns default to "other deduction" - in every muster roll seen
 * so far the columns that come and go (SACCO, HELB, insurance,
 * recoveries) are deductions; the admin confirms before anything saves. */
export function guessColumn(header: string, used: Set<SalaryCoreField>): SalaryTemplateColumn {
  if (!normalizeHeader(header)) return { header, kind: "ignore" };
  const field = guessCoreField(header);
  if (field && !used.has(field)) return { header, kind: "core", field };
  if (/allowance|arrears|bonus|overtime|earning/i.test(header)) return { header, kind: "other_earning" };
  return { header, kind: "other_deduction" };
}
