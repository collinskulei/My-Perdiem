/**
 * @file Pure parsing/validation for Salary Payments uploads - no React, no
 * Supabase, so it can be exercised directly against real files. Input is
 * a sheet as a 2-D array (XLSX.utils.sheet_to_json(ws, { header: 1 })).
 *
 * A muster roll looks like: title row(s) ("Digital Health Agency Muster
 * Roll for Aug 2026"), one header row, one row per employee, then the
 * file's own totals row ("Grand Totals (KES)"). The Payroll Summary is a
 * report-style sheet (label/amount pairs in side-by-side blocks) used only
 * to cross-check a muster roll's totals.
 */
import {
  type SalaryCoreField,
  type SalaryTemplateColumn,
  REQUIRED_SALARY_FIELDS,
  SALARY_FIELD_LABEL,
  guessCoreField,
  normalizeHeader,
  storedName,
} from "./fields";

export type SheetRows = unknown[][];

/** Amount differences at or below this (KES) are rounding, not errors. */
export const SALARY_TOLERANCE = 1;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};
const PERIOD_RE = /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\.?[\s,\-_]*(20\d{2})\b/i;

/** "…Muster Roll for Aug 2026" / "DHA Dec 2025 Payroll Summary.xlsx" ->
 * '2026-08-01'. null if no month + year is found. */
export function parsePeriod(text: string): string | null {
  const m = PERIOD_RE.exec(text);
  if (!m) return null;
  const month = MONTHS[m[1].slice(0, 3).toLowerCase()];
  return `${m[2]}-${String(month).padStart(2, "0")}-01`;
}

export function formatPeriod(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

function cellText(c: unknown): string {
  if (c === null || c === undefined) return "";
  if (c instanceof Date) return c.toISOString();
  return String(c).trim();
}

function isBlankRow(r: unknown[] | undefined): boolean {
  return !r || r.every((c) => cellText(c) === "");
}

/**
 * Parses a money cell. Blank and "-" are 0; "1,234.50", "KES 1,234.50" and
 * "(500)" (negative) are accepted. Returns NaN for anything else so the
 * caller can report the bad cell rather than silently storing 0.
 */
export function parseAmount(c: unknown): number {
  if (typeof c === "number") return Number.isFinite(c) ? c : NaN;
  const raw = cellText(c);
  if (raw === "" || raw === "-" || raw === "–") return 0;
  let s = raw.replace(/kes|ksh|,|\s/gi, "");
  let sign = 1;
  if (/^\(.*\)$/.test(s)) {
    sign = -1;
    s = s.slice(1, -1);
  }
  if (!/^-?\d*\.?\d+$/.test(s)) return NaN;
  return sign * Number(s);
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// --- Header row ---

/**
 * Index of the header row: whichever of the first 30 rows matches the most
 * known columns - the template's headers when there is one, otherwise the
 * core-field guesses. Title rows match nothing, so they're skipped. -1 if
 * no row matches at least 3.
 */
export function findHeaderRow(rows: SheetRows, template?: SalaryTemplateColumn[] | null): number {
  const known = template ? new Set(template.map((c) => normalizeHeader(c.header)).filter(Boolean)) : null;
  let best = -1;
  let bestScore = 0;
  for (let i = 0; i < Math.min(30, rows.length); i++) {
    const cells = (rows[i] ?? []).map(normalizeHeader).filter(Boolean);
    const score = known
      ? cells.filter((c) => known.has(c)).length
      : new Set(cells.map((c) => guessCoreField(c)).filter(Boolean)).size;
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return bestScore >= 3 ? best : -1;
}

export type SalarySheet = {
  headerRowIndex: number;
  headers: string[];
  /** Text above the header row (title lines), joined. */
  title: string;
  periodGuess: string | null;
  /** Everything after the header row. */
  bodyRows: SheetRows;
};

export function readSalarySheet(rows: SheetRows, fileName: string, template?: SalaryTemplateColumn[] | null): SalarySheet | null {
  const headerRowIndex = findHeaderRow(rows, template);
  if (headerRowIndex === -1) return null;
  const width = Math.max(...rows.slice(headerRowIndex, headerRowIndex + 5).map((r) => (r ?? []).length));
  const headerRow = rows[headerRowIndex] ?? [];
  const headers = Array.from({ length: width }, (_, i) => cellText(headerRow[i]));
  const title = rows
    .slice(0, headerRowIndex)
    .map((r) => (r ?? []).map(cellText).filter(Boolean).join(" "))
    .filter(Boolean)
    .join(" · ");
  return {
    headerRowIndex,
    headers,
    title,
    periodGuess: parsePeriod(title) ?? parsePeriod(fileName),
    bodyRows: rows.slice(headerRowIndex + 1),
  };
}

// --- Template matching ---

export type TemplateMatch = {
  /** Per file column: the template column it maps to, or null if unknown. */
  columns: (SalaryTemplateColumn | null)[];
  /** Non-empty headers the template has never seen - must be classified. */
  unknown: { index: number; header: string }[];
  /** Required core fields not present in this file - blocks the upload. */
  missingRequired: SalaryCoreField[];
};

export function matchTemplate(headers: string[], template: SalaryTemplateColumn[]): TemplateMatch {
  const byHeader = new Map(template.map((c) => [normalizeHeader(c.header), c]));
  const columns: (SalaryTemplateColumn | null)[] = [];
  const unknown: { index: number; header: string }[] = [];
  headers.forEach((h, index) => {
    const n = normalizeHeader(h);
    if (!n) {
      columns.push({ header: h, kind: "ignore" });
      return;
    }
    const col = byHeader.get(n);
    if (col) {
      columns.push(col);
    } else {
      columns.push(null);
      unknown.push({ index, header: h });
    }
  });
  const present = new Set(columns.filter((c) => c?.kind === "core").map((c) => c!.field));
  return {
    columns,
    unknown,
    missingRequired: REQUIRED_SALARY_FIELDS.filter((f) => !present.has(f)),
  };
}

/** Validates a column mapping as a template (used when saving one). */
export function templateProblems(columns: SalaryTemplateColumn[]): string[] {
  const problems: string[] = [];
  const counts = new Map<SalaryCoreField, number>();
  for (const c of columns) {
    if (c.kind === "core") {
      if (!c.field) problems.push(`"${c.header}" is marked as a core field but no field is chosen.`);
      else counts.set(c.field, (counts.get(c.field) ?? 0) + 1);
    }
  }
  for (const [field, n] of counts) {
    if (n > 1) problems.push(`${SALARY_FIELD_LABEL[field]} is mapped to ${n} columns - pick one.`);
  }
  for (const f of REQUIRED_SALARY_FIELDS) {
    if (!counts.has(f)) problems.push(`${SALARY_FIELD_LABEL[f]} must be mapped to a column.`);
  }
  const dedNames = new Set(columns.filter((c) => c.kind === "other_deduction").map((c) => normalizeHeader(storedName(c))));
  const clashes = new Set(columns.filter((c) => c.kind === "other_earning" && dedNames.has(normalizeHeader(storedName(c)))).map(storedName));
  for (const name of clashes) problems.push(`"${name}" is used for both a deduction and an earning - give one a different name.`);
  return problems;
}

// --- Rows ---

export type SalaryLineInput = {
  /** 1-based row number in the sheet, for messages. */
  rowNumber: number;
  staffNo: string;
  name: string;
  basicPay: number;
  commuterAllowance: number;
  houseAllowance: number;
  otherEarnings: Record<string, number>;
  grossPay: number;
  housingLevy: number;
  nssf: number;
  shif: number;
  paye: number;
  totalStatutory: number;
  otherDeductions: Record<string, number>;
  totalOtherDeductions: number;
  netPay: number;
  employerHousingLevy: number;
  employerNita: number;
  employerNssf: number;
  warnings: string[];
  errors: string[];
};

const FIELD_PROP: Record<Exclude<SalaryCoreField, "staff_no" | "employee_name">, keyof SalaryLineInput> = {
  basic_pay: "basicPay",
  commuter_allowance: "commuterAllowance",
  house_allowance: "houseAllowance",
  gross_pay: "grossPay",
  housing_levy: "housingLevy",
  nssf: "nssf",
  shif: "shif",
  paye: "paye",
  total_statutory: "totalStatutory",
  total_other_deductions: "totalOtherDeductions",
  net_pay: "netPay",
  employer_housing_levy: "employerHousingLevy",
  employer_nita: "employerNita",
  employer_nssf: "employerNssf",
};

export type TotalsCheck = {
  header: string;
  stated: number;
  computed: number;
};

export type BuiltSalaryRun = {
  lines: SalaryLineInput[];
  /** The file's totals row as header -> amount (only amount columns). */
  statedTotals: Record<string, number>;
  /** Columns where the rows don't add up to the file's own totals row. */
  totalsMismatches: TotalsCheck[];
  totalsRowFound: boolean;
};

const fmt = (n: number) => n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Turns body rows into lines using a fully-classified column list (no
 * nulls - every unknown column must have been classified first). Stops at
 * the totals row (first text cell containing totalsMarker), skips blank
 * rows. Errors block the upload; warnings are stored with the line.
 */
export function buildSalaryRun(
  bodyRows: SheetRows,
  columns: SalaryTemplateColumn[],
  totalsMarker: string,
  headerRowIndex: number
): BuiltSalaryRun {
  const marker = normalizeHeader(totalsMarker || "Grand Totals");
  const lines: SalaryLineInput[] = [];
  let totalsRow: unknown[] | null = null;
  // Per file column, for the totals-row check - by column rather than by
  // stored name, since several columns can share a name.
  const columnSums: number[] = [];
  const fieldIndex = new Map<SalaryCoreField, number>();
  columns.forEach((c, i) => {
    if (c.kind === "core" && c.field && !fieldIndex.has(c.field)) fieldIndex.set(c.field, i);
  });

  for (let r = 0; r < bodyRows.length; r++) {
    const row = bodyRows[r] ?? [];
    if (isBlankRow(row)) continue;
    if (row.some((c) => typeof c === "string" && normalizeHeader(c).includes(marker))) {
      totalsRow = row;
      break;
    }
    const rowNumber = headerRowIndex + r + 2;
    const errors: string[] = [];
    const warnings: string[] = [];
    const line: SalaryLineInput = {
      rowNumber,
      staffNo: cellText(row[fieldIndex.get("staff_no") ?? -1]),
      name: cellText(row[fieldIndex.get("employee_name") ?? -1]).replace(/\s+/g, " "),
      basicPay: 0, commuterAllowance: 0, houseAllowance: 0, otherEarnings: {}, grossPay: 0,
      housingLevy: 0, nssf: 0, shif: 0, paye: 0, totalStatutory: 0, otherDeductions: {},
      totalOtherDeductions: 0, netPay: 0, employerHousingLevy: 0, employerNita: 0, employerNssf: 0,
      warnings, errors,
    };

    columns.forEach((col, i) => {
      if (col.kind === "ignore") return;
      if (col.kind === "core" && (col.field === "staff_no" || col.field === "employee_name")) return;
      const v = parseAmount(row[i]);
      if (Number.isNaN(v)) {
        errors.push(`"${col.header}" isn't a number ("${cellText(row[i])}").`);
        return;
      }
      if (col.kind === "core" && col.field) {
        (line as any)[FIELD_PROP[col.field as keyof typeof FIELD_PROP]] = round2(v);
      } else if (col.kind === "other_deduction" && v !== 0) {
        const name = storedName(col);
        line.otherDeductions[name] = round2((line.otherDeductions[name] ?? 0) + v);
      } else if (col.kind === "other_earning" && v !== 0) {
        const name = storedName(col);
        line.otherEarnings[name] = round2((line.otherEarnings[name] ?? 0) + v);
      }
      columnSums[i] = (columnSums[i] ?? 0) + round2(v);
    });

    if (!line.staffNo) errors.push("Missing Staff No.");
    if (!line.name) errors.push("Missing Employee Name.");

    const sum = (o: Record<string, number>) => Object.values(o).reduce((a, b) => a + b, 0);
    const otherDed = sum(line.otherDeductions);
    const otherEarn = sum(line.otherEarnings);
    const statutory = line.paye + line.nssf + line.shif + line.housingLevy;
    // Totals the file didn't carry are derived, so every stored line is
    // internally complete.
    if (!fieldIndex.has("total_statutory")) line.totalStatutory = round2(statutory);
    if (!fieldIndex.has("total_other_deductions")) line.totalOtherDeductions = round2(otherDed);

    const check = (label: string, stated: number, expected: number) => {
      if (Math.abs(stated - expected) > SALARY_TOLERANCE) {
        warnings.push(`${label} is ${fmt(stated)} but its parts add up to ${fmt(expected)}.`);
      }
    };
    if (fieldIndex.has("basic_pay")) {
      check("Gross Pay", line.grossPay, line.basicPay + line.commuterAllowance + line.houseAllowance + otherEarn);
    }
    check("Total Statutory", line.totalStatutory, statutory);
    check("Total Other Deductions", line.totalOtherDeductions, otherDed);
    check("Net Pay", line.netPay, line.grossPay - line.totalStatutory - line.totalOtherDeductions);
    if (line.netPay < 0) warnings.push("Net Pay is negative.");

    lines.push(line);
  }

  // Duplicate Staff No within one month is an error on every copy.
  const seen = new Map<string, SalaryLineInput[]>();
  for (const l of lines) {
    if (!l.staffNo) continue;
    seen.set(l.staffNo, [...(seen.get(l.staffNo) ?? []), l]);
  }
  for (const [staffNo, dupes] of seen) {
    if (dupes.length > 1) {
      for (const d of dupes) {
        d.errors.push(`Staff No ${staffNo} appears ${dupes.length} times (rows ${dupes.map((x) => x.rowNumber).join(", ")}).`);
      }
    }
  }

  const statedTotals: Record<string, number> = {};
  const totalsMismatches: TotalsCheck[] = [];
  if (totalsRow) {
    columns.forEach((col, i) => {
      if (col.kind === "ignore") return;
      if (col.kind === "core" && (col.field === "staff_no" || col.field === "employee_name")) return;
      const stated = parseAmount(totalsRow![i]);
      if (Number.isNaN(stated) || cellText(totalsRow![i]) === "") return;
      statedTotals[col.header] = round2(stated);
      const computed = round2(columnSums[i] ?? 0);
      if (Math.abs(stated - computed) > SALARY_TOLERANCE) {
        totalsMismatches.push({ header: col.header, stated: round2(stated), computed });
      }
    });
  }

  return { lines, statedTotals, totalsMismatches, totalsRowFound: totalsRow !== null };
}

// --- Run totals ---

export type SalaryRunTotals = {
  headcount: number;
  basicPay: number;
  commuterAllowance: number;
  houseAllowance: number;
  grossPay: number;
  housingLevy: number;
  nssf: number;
  shif: number;
  paye: number;
  totalStatutory: number;
  totalOtherDeductions: number;
  netPay: number;
  employerHousingLevy: number;
  employerNita: number;
  employerNssf: number;
  salaryCost: number;
  otherDeductions: Record<string, number>;
  otherEarnings: Record<string, number>;
};

export function computeRunTotals(lines: SalaryLineInput[]): SalaryRunTotals {
  const t: SalaryRunTotals = {
    headcount: lines.length, basicPay: 0, commuterAllowance: 0, houseAllowance: 0, grossPay: 0,
    housingLevy: 0, nssf: 0, shif: 0, paye: 0, totalStatutory: 0, totalOtherDeductions: 0, netPay: 0,
    employerHousingLevy: 0, employerNita: 0, employerNssf: 0, salaryCost: 0, otherDeductions: {}, otherEarnings: {},
  };
  for (const l of lines) {
    for (const k of Object.values(FIELD_PROP)) (t as any)[k] += (l as any)[k];
    for (const [k, v] of Object.entries(l.otherDeductions)) t.otherDeductions[k] = (t.otherDeductions[k] ?? 0) + v;
    for (const [k, v] of Object.entries(l.otherEarnings)) t.otherEarnings[k] = (t.otherEarnings[k] ?? 0) + v;
  }
  t.salaryCost = t.grossPay + t.employerHousingLevy + t.employerNita + t.employerNssf;
  for (const k of Object.keys(t) as (keyof SalaryRunTotals)[]) {
    if (typeof t[k] === "number") (t as any)[k] = round2(t[k] as number);
  }
  for (const bag of [t.otherDeductions, t.otherEarnings]) {
    for (const k of Object.keys(bag)) bag[k] = round2(bag[k]);
  }
  return t;
}

// --- Payroll Summary cross-check ---

export type PayrollSummary = {
  periodGuess: string | null;
  /** Label as printed -> amount. */
  amounts: { label: string; amount: number }[];
};

/** A Payroll Summary report rather than a muster roll: it says so in its
 * title, or carries the report-only "Salary Cost" line. Checked before
 * header detection, since a summary's label column ("Basic Pay", "House
 * Allowance"...) can look a little like muster-roll headers. */
export function isPayrollSummary(rows: SheetRows): boolean {
  return rows.slice(0, 60).some((r) =>
    (r ?? []).some((c) => typeof c === "string" && /payroll summary|^salary cost$/.test(normalizeHeader(c)))
  );
}

/** Reads the report-style summary: label/amount pairs in the first two
 * columns (earnings, net pay, salary cost, headcount) and in the third
 * column with its amount in the fourth (deductions) or fifth (employer
 * contributions). */
export function readPayrollSummary(rows: SheetRows, fileName: string): PayrollSummary | null {
  const amounts: { label: string; amount: number }[] = [];
  const text: string[] = [];
  for (const r of rows) {
    const row = r ?? [];
    text.push(row.map(cellText).join(" "));
    const pairs: [unknown, unknown][] = [[row[0], row[1]], [row[2], row[3] ?? row[4]]];
    for (const [label, amount] of pairs) {
      if (typeof label === "string" && label.trim() && typeof amount === "number") {
        amounts.push({ label: label.trim(), amount });
      }
    }
  }
  if (amounts.length < 3) return null;
  return { periodGuess: parsePeriod(text.join(" ")) ?? parsePeriod(fileName), amounts };
}

const SUMMARY_LABELS: [RegExp, keyof SalaryRunTotals | null][] = [
  [/^totals?$|^non-cash|^earnings$|^deductions$/, null],
  [/^basic/, "basicPay"],
  [/^hous(e|ing) allowance/, "houseAllowance"],
  [/^commuter/, "commuterAllowance"],
  [/^p\.?a\.?y\.?e/, "paye"],
  [/^n\.?s\.?s\.?f.*employer/, "employerNssf"],
  [/^n\.?s\.?s\.?f\.?$/, "nssf"],
  [/^s\.?h\.?i\.?f/, "shif"],
  [/^housing levy.*employer/, "employerHousingLevy"],
  [/^housing levy$/, "housingLevy"],
  [/^n\.?i\.?t\.?a/, "employerNita"],
  [/^net pay/, "netPay"],
  [/^salary cost/, "salaryCost"],
  [/^total employees|^headcount/, "headcount"],
];

export type SummaryCheck = { label: string; summary: number; musterRoll: number | null; ok: boolean };

export function compareWithSummary(summary: PayrollSummary, totals: SalaryRunTotals): SummaryCheck[] {
  const otherByHeader = new Map(Object.entries(totals.otherDeductions).map(([k, v]) => [normalizeHeader(k), v]));
  const otherEarnByHeader = new Map(Object.entries(totals.otherEarnings).map(([k, v]) => [normalizeHeader(k), v]));
  const checks: SummaryCheck[] = [];
  for (const { label, amount } of summary.amounts) {
    const n = normalizeHeader(label);
    const hit = SUMMARY_LABELS.find(([re]) => re.test(n));
    let musterRoll: number | null;
    if (hit) {
      if (hit[1] === null) continue;
      musterRoll = totals[hit[1]] as number;
    } else {
      musterRoll = otherByHeader.get(n) ?? otherEarnByHeader.get(n) ?? null;
    }
    checks.push({ label, summary: amount, musterRoll, ok: musterRoll !== null && Math.abs(musterRoll - amount) <= SALARY_TOLERANCE });
  }
  return checks;
}
