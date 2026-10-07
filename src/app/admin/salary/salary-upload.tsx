/**
 * @file Salary Payments historical/monthly upload. Drop in one or more
 * muster rolls (and, optionally, the matching Payroll Summary reports -
 * told apart automatically). Each muster roll is read against the
 * employer's current template:
 *
 *   1. Columns the template hasn't seen are listed once, across all files,
 *      to be classified; confirming saves a new template version.
 *   2. Each month is previewed: period (from the title/file name, editable),
 *      row errors (block), row arithmetic warnings (stored with the line),
 *      the file's own totals row, and the Payroll Summary if one was given.
 *   3. Months already on file need "Replace" ticked; a totals mismatch
 *      needs acknowledging. Then each ready month is imported on its own
 *      (import_salary_run) - one month failing doesn't block the others.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, FileSpreadsheet, Loader2, Upload, X, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollableTable } from "@/components/ui/scrollable-table";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import {
  getSalaryTemplates, importSalaryRun, saveSalaryTemplate, SalaryRunExistsError,
  type SalaryEmployer, type SalaryRunSummary,
} from "@/lib/supabase/salary";
import {
  guessColumn, normalizeHeader, SALARY_FIELD_LABEL, storedName,
  type SalaryCoreField, type SalaryTemplate, type SalaryTemplateColumn,
} from "@/lib/salary/fields";
import {
  buildSalaryRun, compareWithSummary, computeRunTotals, formatPeriod, isPayrollSummary, matchTemplate, readPayrollSummary,
  readSalarySheet, templateProblems,
  type BuiltSalaryRun, type PayrollSummary, type SalaryRunTotals, type SalarySheet, type SummaryCheck, type TemplateMatch,
} from "@/lib/salary/parse";
import { SalaryColumnMapper } from "./salary-column-mapper";
import { readWorkbookRows } from "./salary-shared";

type Item = {
  id: string;
  fileName: string;
  rows: unknown[][];
  kind: "muster" | "summary" | "unreadable";
  summary?: PayrollSummary;
  period: string | null;
  replace: boolean;
  acknowledgeTotals: boolean;
  status: "pending" | "importing" | "done" | "error";
  message?: string;
};

type Analysed = {
  item: Item;
  sheet: SalarySheet;
  match: TemplateMatch;
  firstEmployee: unknown[];
  /** null while columns are unclassified or required ones are missing. */
  built: BuiltSalaryRun | null;
  totals: SalaryRunTotals | null;
  summaryChecks: { fileName: string; checks: SummaryCheck[] } | null;
};

let nextId = 0;

export function SalaryUpload({ employer, existingRuns, canSetup, onImported, onOpenSetup }: {
  employer: SalaryEmployer;
  existingRuns: SalaryRunSummary[];
  canSetup: boolean;
  onImported: () => void;
  onOpenSetup: () => void;
}) {
  const { toast } = useToast();
  const [template, setTemplate] = useState<SalaryTemplate | null | undefined>(undefined);
  const [items, setItems] = useState<Item[]>([]);
  const [reading, setReading] = useState(false);
  const [classified, setClassified] = useState<SalaryTemplateColumn[]>([]);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [importing, setImporting] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    setTemplate(undefined);
    setItems([]);
    getSalaryTemplates(employer.id).then((t) => setTemplate(t[0] ?? null));
  }, [employer.id]);

  const existingPeriods = useMemo(
    () => new Set(existingRuns.filter((r) => r.employerId === employer.id).map((r) => r.period)),
    [existingRuns, employer.id]
  );

  const handleFiles = async (files: FileList) => {
    setReading(true);
    const added: Item[] = [];
    for (const file of Array.from(files)) {
      try {
        const rows = await readWorkbookRows(file);
        const summary = isPayrollSummary(rows) ? readPayrollSummary(rows, file.name) : null;
        const sheet = summary ? null : readSalarySheet(rows, file.name, template?.columns ?? null);
        added.push({
          id: String(nextId++),
          fileName: file.name,
          rows,
          kind: sheet ? "muster" : summary ? "summary" : "unreadable",
          summary: summary ?? undefined,
          period: sheet?.periodGuess ?? summary?.periodGuess ?? null,
          replace: false,
          acknowledgeTotals: false,
          status: "pending",
        });
      } catch (error: any) {
        added.push({ id: String(nextId++), fileName: file.name, rows: [], kind: "unreadable", period: null, replace: false, acknowledgeTotals: false, status: "error", message: error.message });
      }
    }
    setItems((prev) => [...prev, ...added].sort((a, b) => (a.period ?? "").localeCompare(b.period ?? "")));
    setReading(false);
  };

  const update = (id: string, patch: Partial<Item>) => setItems((prev) => prev.map((i) => (i.id === id ? { ...i, ...patch } : i)));

  // Everything derived from the files + current template. Recomputed when
  // the template gains a version, so newly classified columns apply.
  const analysed = useMemo((): Analysed[] => {
    if (!template) return [];
    return items.filter((i) => i.kind === "muster").flatMap((item): Analysed[] => {
      // Template-guided header detection first; if the file barely overlaps
      // the template, fall back to the generic guess (it was recognised as a
      // muster roll that way when added).
      const sheet = readSalarySheet(item.rows, item.fileName, template.columns) ?? readSalarySheet(item.rows, item.fileName, null);
      if (!sheet) return [];
      const match = matchTemplate(sheet.headers, template.columns);
      const firstEmployee = sheet.bodyRows.find((r) => (r ?? []).filter((c) => c !== null && c !== "").length >= 3) ?? [];
      if (match.unknown.length > 0 || match.missingRequired.length > 0) {
        return [{ item, sheet, match, firstEmployee, built: null, totals: null, summaryChecks: null }];
      }
      const built = buildSalaryRun(sheet.bodyRows, match.columns as SalaryTemplateColumn[], template.totalsMarker, sheet.headerRowIndex);
      const totals = computeRunTotals(built.lines);
      const summaryItem = items.find((s) => s.kind === "summary" && s.period && s.period === item.period);
      const summaryChecks = summaryItem?.summary ? { fileName: summaryItem.fileName, checks: compareWithSummary(summaryItem.summary, totals) } : null;
      return [{ item, sheet, match, firstEmployee, built, totals, summaryChecks }];
    });
  }, [items, template]);

  // Unknown columns across every file, once each (by normalized header).
  const unknownColumns = useMemo(() => {
    const seen = new Map<string, { header: string; sample: unknown }>();
    for (const a of analysed) {
      for (const u of a.match.unknown) {
        const n = normalizeHeader(u.header);
        if (!seen.has(n)) seen.set(n, { header: u.header, sample: a.firstEmployee[u.index] });
      }
    }
    return Array.from(seen.values());
  }, [analysed]);

  useEffect(() => {
    if (!template) return;
    const used = new Set(template.columns.filter((c) => c.kind === "core" && c.field).map((c) => c.field as SalaryCoreField));
    setClassified(unknownColumns.map((u) => {
      const c = guessColumn(u.header, used);
      if (c.kind === "core" && c.field) used.add(c.field);
      return c;
    }));
  }, [unknownColumns, template]);

  const classifiedProblems = template ? templateProblems([...template.columns, ...classified]) : [];

  const handleSaveClassification = async () => {
    if (!template) return;
    setSavingTemplate(true);
    try {
      const saved = await saveSalaryTemplate(employer.id, [...template.columns, ...classified], {
        totalsMarker: template.totalsMarker,
        sampleFileName: analysed.find((a) => a.match.unknown.length > 0)?.item.fileName ?? null,
        notes: `Added ${classified.map((c) => (c.kind !== "core" && c.kind !== "ignore" && storedName(c) !== c.header ? `${c.header} (as ${storedName(c)})` : c.header)).join(", ")}`,
      });
      setTemplate(saved);
      toast({ title: `Template v${saved.version} saved`, description: `${classified.length} new column${classified.length === 1 ? "" : "s"} classified.` });
    } catch (error: any) {
      toast({ title: "Could not save template", description: error.message, variant: "destructive" });
    } finally {
      setSavingTemplate(false);
    }
  };

  const periodCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const a of analysed) if (a.item.period) m.set(a.item.period, (m.get(a.item.period) ?? 0) + 1);
    return m;
  }, [analysed]);

  const readiness = (a: Analysed) => {
    const blockers: string[] = [];
    if (a.match.missingRequired.length) blockers.push(`Missing required column${a.match.missingRequired.length > 1 ? "s" : ""}: ${a.match.missingRequired.map((f) => SALARY_FIELD_LABEL[f]).join(", ")}.`);
    if (a.match.unknown.length) blockers.push("Has new columns to classify (above).");
    if (!a.item.period) blockers.push("Choose the payroll month.");
    if (a.item.period && (periodCounts.get(a.item.period) ?? 0) > 1) blockers.push(`Another file in this upload is also ${formatPeriod(a.item.period)}.`);
    if (a.built) {
      const rowErrors = a.built.lines.filter((l) => l.errors.length > 0).length;
      if (rowErrors) blockers.push(`${rowErrors} row${rowErrors > 1 ? "s have" : " has"} errors - fix the file and re-add it.`);
      if (a.built.lines.length === 0) blockers.push("No employee rows found.");
      if (a.built.totalsMismatches.length && !a.item.acknowledgeTotals) blockers.push("Rows don't add up to the file's totals row - review and acknowledge.");
    }
    if (a.item.period && existingPeriods.has(a.item.period) && !a.item.replace) blockers.push(`${formatPeriod(a.item.period)} is already on file - tick Replace to overwrite it.`);
    return blockers;
  };

  const ready = analysed.filter((a) => a.item.status !== "done" && a.built && readiness(a).length === 0);

  const handleImport = async () => {
    if (!template) return;
    setImporting(true);
    let ok = 0;
    for (const a of ready) {
      update(a.item.id, { status: "importing", message: undefined });
      try {
        const res = await importSalaryRun({
          employerId: employer.id,
          period: a.item.period!,
          templateId: template.id,
          sourceFileName: a.item.fileName,
          statedTotals: a.built!.statedTotals,
          totalsMismatch: a.built!.totalsMismatches.length > 0,
          lines: a.built!.lines,
          replace: a.item.replace,
        });
        ok += 1;
        update(a.item.id, {
          status: "done",
          message: `${res.replaced ? "Replaced" : "Imported"} ${res.employeeCount} employees${res.newEmployeeCount ? ` (${res.newEmployeeCount} new)` : ""}.`,
        });
      } catch (error: any) {
        update(a.item.id, {
          status: "error",
          message: error instanceof SalaryRunExistsError ? "Already on file - tick Replace to overwrite." : error.message,
        });
      }
    }
    setImporting(false);
    if (ok) {
      toast({ title: "Salary data imported", description: `${ok} month${ok > 1 ? "s" : ""} saved for ${employer.name}.` });
      onImported();
    }
  };

  if (template === undefined) return <Loader2 className="h-6 w-6 animate-spin" />;

  if (template === null) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{employer.name} has no template yet</AlertTitle>
        <AlertDescription className="space-y-2">
          <p>Uploads are read against the employer&apos;s muster-roll template, which a Super Admin sets up once from a sample file.</p>
          {canSetup ? (
            <Button size="sm" variant="outline" onClick={onOpenSetup}>Set up template</Button>
          ) : (
            <p>Ask your Super Admin to set it up.</p>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  const unpairedSummaries = items.filter((s) => s.kind === "summary" && !analysed.some((a) => a.item.period === s.period));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Upload salary data - {employer.name}</CardTitle>
          <CardDescription>
            Add one or more muster rolls (one month each). Payroll Summary reports are optional - add them too and each
            month&apos;s totals are cross-checked against its summary. Using template v{template.version}.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button variant="outline" asChild disabled={reading}>
            <label className="cursor-pointer">
              {reading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Add files
              <input
                type="file"
                multiple
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  if (e.target.files?.length) handleFiles(e.target.files);
                  e.target.value = "";
                }}
              />
            </label>
          </Button>
          {items.length > 0 && (
            <Button variant="ghost" onClick={() => setItems([])} disabled={importing}>Clear</Button>
          )}
        </CardContent>
      </Card>

      {unknownColumns.length > 0 && (
        <Card className="border-amber-500/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-amber-500" />New columns to classify</CardTitle>
            <CardDescription>
              These columns aren&apos;t in {employer.name}&apos;s template yet. Choose how each is stored - your choice is
              saved as template v{template.version + 1} and used for every future upload.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <SalaryColumnMapper
              columns={classified}
              onChange={setClassified}
              samples={unknownColumns.map((u) => u.sample)}
              knownNames={template.columns.filter((c) => c.kind === "other_deduction" || c.kind === "other_earning").map(storedName)}
            />
            {classifiedProblems.length > 0 && (
              <Alert variant="destructive">
                <AlertDescription>
                  <ul className="list-disc pl-4">{classifiedProblems.map((p) => <li key={p}>{p}</li>)}</ul>
                </AlertDescription>
              </Alert>
            )}
            <Button onClick={handleSaveClassification} disabled={savingTemplate || classifiedProblems.length > 0}>
              {savingTemplate && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save as template v{template.version + 1} &amp; continue
            </Button>
          </CardContent>
        </Card>
      )}

      {analysed.map((a) => {
        const blockers = readiness(a);
        const warnLines = a.built?.lines.filter((l) => l.warnings.length > 0) ?? [];
        const errLines = a.built?.lines.filter((l) => l.errors.length > 0) ?? [];
        const isOpen = expanded === a.item.id;
        const exists = !!a.item.period && existingPeriods.has(a.item.period);
        return (
          <Card key={a.item.id}>
            <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-4 space-y-0">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileSpreadsheet className="h-4 w-4" />
                  {a.item.period ? formatPeriod(a.item.period) : "Month not detected"}
                  {a.item.status === "done" && <Badge className="bg-emerald-600">Imported</Badge>}
                  {a.item.status === "error" && <Badge variant="destructive">Failed</Badge>}
                  {a.item.status === "pending" && blockers.length === 0 && a.built && <Badge variant="secondary">Ready</Badge>}
                  {exists && a.item.status !== "done" && <Badge variant="outline">Already on file</Badge>}
                </CardTitle>
                <CardDescription>{a.item.fileName}</CardDescription>
              </div>
              <div className="flex items-end gap-2">
                <div className="space-y-1">
                  <Label htmlFor={`period-${a.item.id}`} className="text-xs">Payroll month</Label>
                  <Input
                    id={`period-${a.item.id}`}
                    type="month"
                    className="w-40"
                    value={a.item.period?.slice(0, 7) ?? ""}
                    onChange={(e) => update(a.item.id, { period: e.target.value ? `${e.target.value}-01` : null, status: "pending", message: undefined })}
                    disabled={a.item.status === "done"}
                  />
                </div>
                <Button variant="ghost" size="icon" onClick={() => setItems((prev) => prev.filter((i) => i.id !== a.item.id))} aria-label="Remove file">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {a.totals && (
                <div className="grid gap-2 grid-cols-2 sm:grid-cols-5 text-sm">
                  <div><p className="text-muted-foreground text-xs">Employees</p><p className="font-semibold tabular-nums">{a.totals.headcount}</p></div>
                  <div><p className="text-muted-foreground text-xs">Gross Pay</p><p className="font-semibold tabular-nums">{formatCurrency(a.totals.grossPay)}</p></div>
                  <div><p className="text-muted-foreground text-xs">Statutory</p><p className="font-semibold tabular-nums">{formatCurrency(a.totals.totalStatutory)}</p></div>
                  <div><p className="text-muted-foreground text-xs">Net Pay</p><p className="font-semibold tabular-nums">{formatCurrency(a.totals.netPay)}</p></div>
                  <div><p className="text-muted-foreground text-xs">Salary Cost</p><p className="font-semibold tabular-nums">{formatCurrency(a.totals.salaryCost)}</p></div>
                </div>
              )}

              {a.built && (
                <ul className="space-y-1 text-sm">
                  <li className="flex items-center gap-2">
                    {!a.built.totalsRowFound ? <AlertTriangle className="h-4 w-4 text-amber-500" /> : a.built.totalsMismatches.length ? <XCircle className="h-4 w-4 text-destructive" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                    {!a.built.totalsRowFound
                      ? `No "${template.totalsMarker}" row found - totals can't be checked against the file.`
                      : a.built.totalsMismatches.length
                        ? `Rows don't add up to the file's totals row in ${a.built.totalsMismatches.length} column${a.built.totalsMismatches.length > 1 ? "s" : ""}: ${a.built.totalsMismatches.map((m) => `${m.header} (file ${formatCurrency(m.stated)}, rows ${formatCurrency(m.computed)})`).join("; ")}`
                        : "Rows add up to the file's own totals row."}
                  </li>
                  {a.summaryChecks && (
                    <li className="flex items-center gap-2">
                      {a.summaryChecks.checks.every((c) => c.ok) ? <CheckCircle2 className="h-4 w-4 text-emerald-600" /> : <XCircle className="h-4 w-4 text-destructive" />}
                      {a.summaryChecks.checks.every((c) => c.ok)
                        ? `Matches the Payroll Summary (${a.summaryChecks.fileName}).`
                        : `Differs from the Payroll Summary: ${a.summaryChecks.checks.filter((c) => !c.ok).map((c) => `${c.label} (summary ${c.summary.toLocaleString()}, muster roll ${c.musterRoll === null ? "missing" : c.musterRoll.toLocaleString()})`).join("; ")}`}
                    </li>
                  )}
                  <li className="flex items-center gap-2">
                    {warnLines.length ? <AlertTriangle className="h-4 w-4 text-amber-500" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                    {warnLines.length ? `${warnLines.length} row${warnLines.length > 1 ? "s don't" : " doesn't"} add up (kept as warnings on the record).` : "Every row adds up (gross, statutory, net)."}
                  </li>
                </ul>
              )}

              {blockers.length > 0 && a.item.status !== "done" && (
                <Alert variant="destructive">
                  <AlertDescription>
                    <ul className="list-disc pl-4">{blockers.map((b) => <li key={b}>{b}</li>)}</ul>
                  </AlertDescription>
                </Alert>
              )}

              {a.item.status !== "done" && (exists || (a.built?.totalsMismatches.length ?? 0) > 0) && (
                <div className="flex flex-wrap gap-6">
                  {exists && (
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={a.item.replace} onCheckedChange={(v) => update(a.item.id, { replace: v === true })} />
                      Replace the {formatPeriod(a.item.period!)} already on file
                    </label>
                  )}
                  {(a.built?.totalsMismatches.length ?? 0) > 0 && (
                    <label className="flex items-center gap-2 text-sm">
                      <Checkbox checked={a.item.acknowledgeTotals} onCheckedChange={(v) => update(a.item.id, { acknowledgeTotals: v === true })} />
                      I&apos;ve reviewed the totals difference - import anyway
                    </label>
                  )}
                </div>
              )}

              {a.item.message && (
                <p className={a.item.status === "error" ? "text-sm text-destructive" : "text-sm text-emerald-700 dark:text-emerald-400"}>{a.item.message}</p>
              )}

              {(warnLines.length > 0 || errLines.length > 0) && (
                <>
                  <Button variant="ghost" size="sm" onClick={() => setExpanded(isOpen ? null : a.item.id)}>
                    {isOpen ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                    {isOpen ? "Hide" : "Show"} rows with issues
                  </Button>
                  {isOpen && (
                    <ScrollableTable containerClassName="max-h-80 border rounded-md" stickyHeader aria-label="Rows with issues">
                      <TableHeader>
                        <TableRow>
                          <TableHead>Row</TableHead>
                          <TableHead>Staff No</TableHead>
                          <TableHead>Name</TableHead>
                          <TableHead>Issue</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {[...errLines, ...warnLines.filter((l) => l.errors.length === 0)].slice(0, 200).map((l) => (
                          <TableRow key={l.rowNumber}>
                            <TableCell className="tabular-nums">{l.rowNumber}</TableCell>
                            <TableCell>{l.staffNo || "-"}</TableCell>
                            <TableCell>{l.name || "-"}</TableCell>
                            <TableCell className="whitespace-normal">
                              {l.errors.map((e) => <p key={e} className="text-destructive">{e}</p>)}
                              {l.warnings.map((w) => <p key={w} className="text-amber-700 dark:text-amber-400">{w}</p>)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </ScrollableTable>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        );
      })}

      {unpairedSummaries.length > 0 && (
        <p className="text-sm text-muted-foreground">
          Payroll Summar{unpairedSummaries.length > 1 ? "ies" : "y"} with no matching muster roll in this upload:{" "}
          {unpairedSummaries.map((s) => `${s.fileName}${s.period ? ` (${formatPeriod(s.period)})` : ""}`).join(", ")}.
        </p>
      )}
      {items.filter((i) => i.kind === "unreadable").map((i) => (
        <p key={i.id} className="text-sm text-destructive">
          {i.fileName}: not recognised as a muster roll or Payroll Summary{i.message ? ` (${i.message})` : ""}.
        </p>
      ))}

      {analysed.length > 0 && (
        <div className="flex items-center gap-3">
          <Button onClick={handleImport} disabled={importing || ready.length === 0}>
            {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Import {ready.length} ready month{ready.length === 1 ? "" : "s"}
          </Button>
          {ready.length < analysed.filter((a) => a.item.status !== "done").length && (
            <span className="text-sm text-muted-foreground">Months with issues above are skipped until resolved.</span>
          )}
        </div>
      )}
    </div>
  );
}
