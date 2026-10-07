/**
 * @file Helpers shared by the Salary Payments tabs: per-month rollups
 * across employers, the column-mapping select's options, and Excel
 * exports (SheetJS, same library the importers read with).
 */
import * as XLSX from "xlsx";
import type { SalaryLine, SalaryRunSummary } from "@/lib/supabase/salary";
import { SALARY_CORE_FIELDS, type SalaryTemplateColumn } from "@/lib/salary/fields";
import { formatPeriod } from "@/lib/salary/parse";

export type PeriodRollup = Omit<SalaryRunSummary,
  "runId" | "employerId" | "employerName" | "clientId" | "sourceFileName" | "importedAt" | "templateId" | "statedTotals" | "totalsMismatch" | "warningCount"
> & { label: string; employerContributions: number; runCount: number };

const SUM_KEYS = [
  "headcount", "basicPay", "commuterAllowance", "houseAllowance", "grossPay", "housingLevy", "nssf", "shif", "paye",
  "totalStatutory", "totalOtherDeductions", "netPay", "employerHousingLevy", "employerNita", "employerNssf", "salaryCost",
] as const;

/** Sums every employer's run for the same month - oldest first. */
export function rollupByPeriod(summaries: SalaryRunSummary[]): PeriodRollup[] {
  const map = new Map<string, PeriodRollup>();
  for (const s of summaries) {
    const r = map.get(s.period) ?? ({
      period: s.period, label: formatPeriod(s.period), runCount: 0, employerContributions: 0,
      otherDeductionTotals: {}, otherEarningTotals: {},
      ...Object.fromEntries(SUM_KEYS.map((k) => [k, 0])),
    } as PeriodRollup);
    for (const k of SUM_KEYS) (r as any)[k] += s[k];
    for (const [k, v] of Object.entries(s.otherDeductionTotals)) r.otherDeductionTotals[k] = (r.otherDeductionTotals[k] ?? 0) + v;
    for (const [k, v] of Object.entries(s.otherEarningTotals)) r.otherEarningTotals[k] = (r.otherEarningTotals[k] ?? 0) + v;
    r.employerContributions = r.employerHousingLevy + r.employerNita + r.employerNssf;
    r.runCount += 1;
    map.set(s.period, r);
  }
  return Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period));
}

// --- Column mapping select ---

/** One select value per mapping choice: "core:<field>" or a non-core kind. */
export function columnChoice(c: SalaryTemplateColumn): string {
  return c.kind === "core" ? `core:${c.field}` : c.kind;
}

export function applyChoice(c: SalaryTemplateColumn, choice: string): SalaryTemplateColumn {
  if (choice.startsWith("core:")) return { header: c.header, kind: "core", field: choice.slice(5) as any };
  const kind = choice as SalaryTemplateColumn["kind"];
  // A typed name survives switching between deduction and earning.
  return kind === "ignore" || !c.name ? { header: c.header, kind } : { header: c.header, kind, name: c.name };
}

export const COLUMN_CHOICES: { value: string; label: string; group: string }[] = [
  { value: "other_deduction", label: "Other deduction", group: "Varies month to month" },
  { value: "other_earning", label: "Other earning", group: "Varies month to month" },
  { value: "ignore", label: "Ignore this column", group: "Varies month to month" },
  ...SALARY_CORE_FIELDS.map((f) => ({ value: `core:${f.key}`, label: f.label, group: f.group })),
];

// --- Excel ---

function sanitize(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "-");
}

/** One month's lines laid out like a muster roll (core columns, then one
 * column per other deduction/earning seen that month). */
export function exportRunLines(lines: SalaryLine[], employerName: string, period: string) {
  const otherEarn = Array.from(new Set(lines.flatMap((l) => Object.keys(l.otherEarnings))));
  const otherDed = Array.from(new Set(lines.flatMap((l) => Object.keys(l.otherDeductions))));
  const header = [
    "Staff No", "Employee Name", "Basic Pay", "Commuter Allowance", "House Allowance", ...otherEarn, "Gross Pay",
    "Housing Levy", "NSSF", "SHIF", "PAYE", "Total Statutory", ...otherDed, "Total Other Deductions", "Net Pay",
    "Housing Levy (Employer)", "NITA (Employer)", "NSSF (Employer)", "Warnings",
  ];
  const row = (l: SalaryLine) => [
    l.staffNo, l.employeeName, l.basicPay, l.commuterAllowance, l.houseAllowance, ...otherEarn.map((k) => l.otherEarnings[k] ?? 0), l.grossPay,
    l.housingLevy, l.nssf, l.shif, l.paye, l.totalStatutory, ...otherDed.map((k) => l.otherDeductions[k] ?? 0), l.totalOtherDeductions, l.netPay,
    l.employerHousingLevy, l.employerNita, l.employerNssf, l.warnings.join(" "),
  ];
  const body = lines.map(row);
  const totals = header.map((_, i) =>
    i === 1 ? "Totals (KES)" : i < 2 || i === header.length - 1 ? "" : body.reduce((acc, r) => acc + (Number(r[i]) || 0), 0)
  );
  const aoa = [[`${employerName} Salary for ${formatPeriod(period)}`], header, ...body, totals];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), formatPeriod(period));
  XLSX.writeFile(wb, `${sanitize(employerName)}_salary_${period.slice(0, 7)}.xlsx`);
}

export function exportTable(title: string, header: string[], rows: (string | number)[][], fileBase: string) {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[title], header, ...rows]), "Sheet1");
  XLSX.writeFile(wb, `${sanitize(fileBase)}.xlsx`);
}

/** An empty muster roll in the template's exact column order, for a client
 * to fill in. */
export function downloadBlankTemplate(columns: SalaryTemplateColumn[], totalsMarker: string, employerName: string, version: number) {
  const aoa = [
    [`${employerName} Muster Roll for <Month YYYY>`],
    columns.map((c) => c.header),
    columns.map(() => ""),
    columns.map((c, i) => (i === columns.findIndex((x) => x.kind === "core" && x.field === "employee_name") ? `${totalsMarker} (KES)` : "")),
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Muster Roll");
  XLSX.writeFile(wb, `${sanitize(employerName)}_muster-roll-template_v${version}.xlsx`);
}

/** Reads the first non-empty sheet of an uploaded file as a 2-D array. */
export async function readWorkbookRows(file: File): Promise<unknown[][]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array", cellDates: true });
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: null }) as unknown[][];
    if (rows.some((r) => (r ?? []).filter((c) => c !== null && String(c).trim() !== "").length >= 2)) return rows;
  }
  return [];
}

// --- Employee statement ---

/** One employee's months laid out like a payroll: gross, each deduction
 * (statutory, then every other deduction they had, by name), total
 * deductions, net - oldest month first, with a totals row. */
export function employeeStatement(lines: SalaryLine[]) {
  const sorted = [...lines].sort((a, b) => (a.period ?? "").localeCompare(b.period ?? ""));
  const otherDed = Array.from(new Set(sorted.flatMap((l) => Object.keys(l.otherDeductions)))).sort();
  const header = ["Month", "Gross Pay", "PAYE", "NSSF", "SHIF", "Housing Levy", ...otherDed, "Total Deductions", "Net Pay"];
  const rows = sorted.map((l) => [
    l.period ? formatPeriod(l.period) : "-",
    l.grossPay, l.paye, l.nssf, l.shif, l.housingLevy,
    ...otherDed.map((k) => l.otherDeductions[k] ?? 0),
    l.totalStatutory + l.totalOtherDeductions,
    l.netPay,
  ] as [string, ...number[]]);
  const totals = ["Total", ...header.slice(1).map((_, i) => Math.round(rows.reduce((acc, r) => acc + (r[i + 1] as number), 0) * 100) / 100)] as [string, ...number[]];
  return { header, rows, totals, otherDed };
}

function statementTitle(employerName: string, staffNo: string, name: string) {
  return `${employerName} - Salary statement - ${name} (Staff No ${staffNo})`;
}

export function exportEmployeeStatementExcel(lines: SalaryLine[], employerName: string, staffNo: string, name: string) {
  const { header, rows, totals } = employeeStatement(lines);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[statementTitle(employerName, staffNo, name)], header, ...rows, totals]), "Statement");
  XLSX.writeFile(wb, `${sanitize(name)}_${sanitize(staffNo)}_salary-statement.xlsx`);
}

export async function exportEmployeeStatementPdf(lines: SalaryLine[], employerName: string, staffNo: string, name: string) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const { header, rows, totals } = employeeStatement(lines);
  const money = (v: string | number) => (typeof v === "number" ? v.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : v);
  const doc = new jsPDF({ orientation: header.length > 9 ? "landscape" : "portrait" });
  doc.setFontSize(14);
  doc.text(name, 14, 16);
  doc.setFontSize(10);
  doc.text(`Staff No ${staffNo} · ${employerName} · ${rows.length} month${rows.length === 1 ? "" : "s"} · amounts in KES`, 14, 23);
  autoTable(doc, {
    startY: 28,
    head: [header],
    body: rows.map((r) => r.map(money)),
    foot: [totals.map(money)],
    styles: { fontSize: 8 },
    headStyles: { fillColor: [16, 185, 129] },
    footStyles: { fillColor: [240, 240, 240], textColor: 20, fontStyle: "bold" },
    columnStyles: Object.fromEntries(header.slice(1).map((_, i) => [i + 1, { halign: "right" }])),
  });
  doc.save(`${sanitize(name)}_${sanitize(staffNo)}_salary-statement.pdf`);
}
