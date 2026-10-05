/**
 * @file Salary Payments "Monthly Runs" tab: one row per employer-month with
 * its totals and checks, a drill-down into every employee's line, Excel
 * export, and (Super Admin+) deleting a month.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, Eye, Loader2, Search, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollableTable } from "@/components/ui/scrollable-table";
import { TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { deleteSalaryRun, getSalaryRunLines, type SalaryLine, type SalaryRunSummary } from "@/lib/supabase/salary";
import { formatPeriod } from "@/lib/salary/parse";
import { EmptyState } from "../insights/shared";
import { exportRunLines, exportTable } from "./salary-shared";

const money = (n: number) => n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function RunDetailDialog({ run, onClose }: { run: SalaryRunSummary | null; onClose: () => void }) {
  const [lines, setLines] = useState<SalaryLine[] | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setLines(null);
    setQuery("");
    if (run) getSalaryRunLines(run.runId).then(setLines);
  }, [run]);

  const otherDed = useMemo(() => Array.from(new Set((lines ?? []).flatMap((l) => Object.keys(l.otherDeductions)))), [lines]);
  const otherEarn = useMemo(() => Array.from(new Set((lines ?? []).flatMap((l) => Object.keys(l.otherEarnings)))), [lines]);
  const shown = (lines ?? []).filter((l) => {
    const q = query.trim().toLowerCase();
    return !q || l.staffNo.toLowerCase().includes(q) || l.employeeName.toLowerCase().includes(q);
  });

  return (
    <Dialog open={run !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl">
        <DialogHeader>
          <DialogTitle>{run ? `${run.employerName} - ${formatPeriod(run.period)}` : ""}</DialogTitle>
          <DialogDescription>
            {run?.headcount} employees{run?.sourceFileName ? ` · from ${run.sourceFileName}` : ""}
            {run ? ` · imported ${new Date(run.importedAt).toLocaleString("en-GB")}` : ""}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8 w-64" placeholder="Search staff no or name" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          {run && lines && (
            <Button variant="outline" size="sm" onClick={() => exportRunLines(lines, run.employerName, run.period)}>
              <Download className="mr-2 h-4 w-4" />
              Excel
            </Button>
          )}
        </div>
        {lines === null ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : (
          <ScrollableTable containerClassName="max-h-[60vh] border rounded-md" stickyHeader aria-label="Employee lines">
            <TableHeader>
              <TableRow>
                <TableHead>Staff No</TableHead>
                <TableHead>Employee Name</TableHead>
                <TableHead className="text-right">Basic</TableHead>
                <TableHead className="text-right">Commuter</TableHead>
                <TableHead className="text-right">House</TableHead>
                {otherEarn.map((k) => <TableHead key={`e-${k}`} className="text-right">{k}</TableHead>)}
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">Housing Levy</TableHead>
                <TableHead className="text-right">NSSF</TableHead>
                <TableHead className="text-right">SHIF</TableHead>
                <TableHead className="text-right">PAYE</TableHead>
                <TableHead className="text-right">Total Statutory</TableHead>
                {otherDed.map((k) => <TableHead key={`d-${k}`} className="text-right">{k}</TableHead>)}
                <TableHead className="text-right">Net Pay</TableHead>
                <TableHead className="text-right">Employer Contrib.</TableHead>
                <TableHead>Checks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((l) => (
                <TableRow key={l.id}>
                  <TableCell>{l.staffNo}</TableCell>
                  <TableCell>{l.employeeName}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(l.basicPay)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(l.commuterAllowance)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(l.houseAllowance)}</TableCell>
                  {otherEarn.map((k) => <TableCell key={`e-${k}`} className="text-right tabular-nums">{money(l.otherEarnings[k] ?? 0)}</TableCell>)}
                  <TableCell className="text-right tabular-nums font-medium">{money(l.grossPay)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(l.housingLevy)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(l.nssf)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(l.shif)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(l.paye)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(l.totalStatutory)}</TableCell>
                  {otherDed.map((k) => <TableCell key={`d-${k}`} className="text-right tabular-nums">{money(l.otherDeductions[k] ?? 0)}</TableCell>)}
                  <TableCell className="text-right tabular-nums font-medium">{money(l.netPay)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(l.employerHousingLevy + l.employerNita + l.employerNssf)}</TableCell>
                  <TableCell className="whitespace-normal min-w-[12rem]">
                    {l.warnings.length === 0 ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : (
                      l.warnings.map((w) => <p key={w} className="text-xs text-amber-700 dark:text-amber-400">{w}</p>)
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </ScrollableTable>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function SalaryRuns({ summaries, canDelete, onChanged }: {
  summaries: SalaryRunSummary[];
  canDelete: boolean;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState<SalaryRunSummary | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const multiEmployer = new Set(summaries.map((s) => s.employerId)).size > 1;

  if (summaries.length === 0) {
    return <EmptyState message="No salary months on file yet - upload muster rolls from the Upload tab." />;
  }

  const handleDelete = async (run: SalaryRunSummary) => {
    if (!window.confirm(`Delete ${run.employerName}'s ${formatPeriod(run.period)} salary data (${run.headcount} employees)? This can't be undone - you can re-upload the file afterwards.`)) return;
    setDeleting(run.runId);
    try {
      await deleteSalaryRun(run.runId);
      toast({ title: "Month deleted", description: `${formatPeriod(run.period)} removed.` });
      onChanged();
    } catch (error: any) {
      toast({ title: "Could not delete", description: error.message, variant: "destructive" });
    } finally {
      setDeleting(null);
    }
  };

  const sum = (k: keyof SalaryRunSummary) => summaries.reduce((acc, s) => acc + (s[k] as number), 0);
  const employerContrib = (s: SalaryRunSummary) => s.employerHousingLevy + s.employerNita + s.employerNssf;

  const handleExport = () => exportTable(
    "Salary Payments - Monthly Runs",
    ["Month", "Employer", "Employees", "Gross Pay", "Total Statutory", "Other Deductions", "Net Pay", "Employer Contributions", "Salary Cost", "Rows with warnings", "Source file"],
    summaries.map((s) => [formatPeriod(s.period), s.employerName, s.headcount, s.grossPay, s.totalStatutory, s.totalOtherDeductions, s.netPay, employerContrib(s), s.salaryCost, s.warningCount, s.sourceFileName ?? ""]),
    "salary-monthly-runs"
  );

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
        <div className="space-y-1">
          <CardTitle>Monthly Runs</CardTitle>
          <CardDescription>Salary cost = gross pay + employer contributions (housing levy, NITA, NSSF).</CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" />
          Excel
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollableTable aria-label="Monthly runs">
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              {multiEmployer && <TableHead>Employer</TableHead>}
              <TableHead className="text-right">Employees</TableHead>
              <TableHead className="text-right">Gross Pay</TableHead>
              <TableHead className="text-right">Statutory</TableHead>
              <TableHead className="text-right">Other Ded.</TableHead>
              <TableHead className="text-right">Net Pay</TableHead>
              <TableHead className="text-right">Employer Contrib.</TableHead>
              <TableHead className="text-right">Salary Cost</TableHead>
              <TableHead>Checks</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {summaries.map((s) => (
              <TableRow key={s.runId}>
                <TableCell className="font-medium">{formatPeriod(s.period)}</TableCell>
                {multiEmployer && <TableCell>{s.employerName}</TableCell>}
                <TableCell className="text-right tabular-nums">{s.headcount}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(s.grossPay)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(s.totalStatutory)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(s.totalOtherDeductions)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(s.netPay)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(employerContrib(s))}</TableCell>
                <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(s.salaryCost)}</TableCell>
                <TableCell>
                  {s.totalsMismatch && <Badge variant="destructive" className="mr-1">Totals differ</Badge>}
                  {s.warningCount > 0 && (
                    <Badge variant="outline" className="gap-1"><AlertTriangle className="h-3 w-3" />{s.warningCount}</Badge>
                  )}
                  {!s.totalsMismatch && s.warningCount === 0 && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="ghost" size="icon" onClick={() => setOpen(s)} aria-label="View employees"><Eye className="h-4 w-4" /></Button>
                  {canDelete && (
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(s)} disabled={deleting === s.runId} aria-label="Delete month">
                      {deleting === s.runId ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Total</TableCell>
              {multiEmployer && <TableCell />}
              <TableCell />
              <TableCell className="text-right tabular-nums">{formatCurrency(sum("grossPay"))}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(sum("totalStatutory"))}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(sum("totalOtherDeductions"))}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(sum("netPay"))}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(summaries.reduce((a, s) => a + employerContrib(s), 0))}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(sum("salaryCost"))}</TableCell>
              <TableCell colSpan={2} />
            </TableRow>
          </TableFooter>
        </ScrollableTable>
      </CardContent>
      <RunDetailDialog run={open} onClose={() => setOpen(null)} />
    </Card>
  );
}
