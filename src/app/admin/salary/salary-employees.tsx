/**
 * @file Salary Payments "Employees" tab: everyone an employer has paid, by
 * Staff No as it appears in the files, with totals across every month on
 * file. A row expands into the employee's payroll month by month (gross,
 * each deduction, net), downloadable as an Excel or PDF statement.
 */
"use client";

import { Fragment, useEffect, useState } from "react";
import { ChevronDown, ChevronRight, Download, FileText, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollableTable } from "@/components/ui/scrollable-table";
import { TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import {
  getSalaryEmployeeHistory, getSalaryEmployeeSummaries,
  type SalaryEmployeeSummary, type SalaryEmployer, type SalaryLine,
} from "@/lib/supabase/salary";
import { formatPeriod } from "@/lib/salary/parse";
import { EmptyState } from "../insights/shared";
import { employeeStatement, exportEmployeeStatementExcel, exportEmployeeStatementPdf, exportTable } from "./salary-shared";

const COLUMN_COUNT = 9;

function EmployeeStatement({ employee, employerName, lines }: {
  employee: SalaryEmployeeSummary;
  employerName: string;
  lines: SalaryLine[] | undefined;
}) {
  const [pdfing, setPdfing] = useState(false);
  if (lines === undefined) return <Loader2 className="h-5 w-5 animate-spin" />;
  if (lines.length === 0) return <p className="text-sm text-muted-foreground">No months on file.</p>;
  const { header, rows, totals } = employeeStatement(lines);
  const cell = (v: string | number) => (typeof v === "number" ? formatCurrency(v) : v);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">Payroll by month - amounts in KES</p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => exportEmployeeStatementExcel(lines, employerName, employee.staffNo, employee.name)}>
            <Download className="mr-2 h-4 w-4" />
            Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={pdfing}
            onClick={async () => {
              setPdfing(true);
              try {
                await exportEmployeeStatementPdf(lines, employerName, employee.staffNo, employee.name);
              } finally {
                setPdfing(false);
              }
            }}
          >
            {pdfing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileText className="mr-2 h-4 w-4" />}
            PDF
          </Button>
        </div>
      </div>
      <ScrollableTable containerClassName="border rounded-md bg-background" aria-label={`Salary statement for ${employee.name}`}>
        <TableHeader>
          <TableRow>
            {header.map((h, i) => <TableHead key={h} className={i === 0 ? undefined : "text-right"}>{h}</TableHead>)}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((r) => (
            <TableRow key={r[0]}>
              {r.map((v, i) => (
                <TableCell key={i} className={i === 0 ? "font-medium" : `text-right tabular-nums${i === r.length - 1 ? " font-medium" : ""}`}>{cell(v)}</TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
        <TableFooter>
          <TableRow>
            {totals.map((v, i) => <TableCell key={i} className={i === 0 ? undefined : "text-right tabular-nums"}>{cell(v)}</TableCell>)}
          </TableRow>
        </TableFooter>
      </ScrollableTable>
    </div>
  );
}

export function SalaryEmployees({ employer, refreshKey }: { employer: SalaryEmployer; refreshKey: number }) {
  const [employees, setEmployees] = useState<SalaryEmployeeSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [history, setHistory] = useState<Record<string, SalaryLine[]>>({});

  useEffect(() => {
    setEmployees(null);
    setExpanded(new Set());
    setHistory({});
    getSalaryEmployeeSummaries(employer.id).then(setEmployees);
  }, [employer.id, refreshKey]);

  const toggle = (e: SalaryEmployeeSummary) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(e.employeeId)) next.delete(e.employeeId);
      else next.add(e.employeeId);
      return next;
    });
    if (!history[e.employeeId]) {
      getSalaryEmployeeHistory(e.employeeId).then((lines) => setHistory((prev) => ({ ...prev, [e.employeeId]: lines })));
    }
  };

  if (employees === null) return <Loader2 className="h-6 w-6 animate-spin" />;
  if (employees.length === 0) return <EmptyState message={`No employees on file for ${employer.name} yet.`} />;

  const latestPeriod = employees.reduce((max, e) => (e.lastPeriod && e.lastPeriod > max ? e.lastPeriod : max), "");
  const q = query.trim().toLowerCase();
  const shown = employees.filter((e) => !q || e.staffNo.toLowerCase().includes(q) || e.name.toLowerCase().includes(q));
  const sum = (k: "totalGross" | "totalDeductions" | "totalNet") => shown.reduce((acc, e) => acc + e[k], 0);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
        <div className="space-y-1">
          <CardTitle>Employees - {employer.name}</CardTitle>
          <CardDescription>
            {employees.length} people on file · {employees.filter((e) => e.lastPeriod === latestPeriod).length} paid in{" "}
            {latestPeriod ? formatPeriod(latestPeriod) : "the latest month"} · click a row for the month-by-month payroll
          </CardDescription>
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input className="pl-8 w-56" placeholder="Search staff no or name" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-10"
            onClick={() => exportTable(
              `${employer.name} - Employees`,
              ["Staff No", "Name", "First Month", "Last Month", "Months Paid", "Total Gross", "Total Deductions", "Total Net"],
              [
                ...employees.map((e) => [e.staffNo, e.name, e.firstPeriod ? formatPeriod(e.firstPeriod) : "", e.lastPeriod ? formatPeriod(e.lastPeriod) : "", e.monthsPaid, e.totalGross, e.totalDeductions, e.totalNet]),
                ["", "Total", "", "", "", ...(["totalGross", "totalDeductions", "totalNet"] as const).map((k) => employees.reduce((acc, e) => acc + e[k], 0))],
              ],
              `${employer.name}-employees`
            )}
          >
            <Download className="mr-2 h-4 w-4" />
            Excel
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <ScrollableTable containerClassName="max-h-[65vh]" stickyHeader aria-label="Employees">
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Staff No</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>First Month</TableHead>
              <TableHead>Last Month</TableHead>
              <TableHead className="text-right">Months</TableHead>
              <TableHead className="text-right">Total Gross</TableHead>
              <TableHead className="text-right">Total Deductions</TableHead>
              <TableHead className="text-right">Total Net</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((e) => {
              const isOpen = expanded.has(e.employeeId);
              return (
                <Fragment key={e.employeeId}>
                  <TableRow className="cursor-pointer" onClick={() => toggle(e)} aria-expanded={isOpen}>
                    <TableCell>{isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</TableCell>
                    <TableCell>{e.staffNo}</TableCell>
                    <TableCell className="font-medium">{e.name}</TableCell>
                    <TableCell>{e.firstPeriod ? formatPeriod(e.firstPeriod) : "-"}</TableCell>
                    <TableCell>
                      {e.lastPeriod ? formatPeriod(e.lastPeriod) : "-"}
                      {e.lastPeriod && e.lastPeriod !== latestPeriod && <span className="ml-1 text-xs text-muted-foreground">(not in latest)</span>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{e.monthsPaid}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(e.totalGross)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(e.totalDeductions)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatCurrency(e.totalNet)}</TableCell>
                  </TableRow>
                  {isOpen && (
                    <TableRow className="bg-muted/40 hover:bg-muted/40">
                      <TableCell colSpan={COLUMN_COUNT} className="p-4">
                        <EmployeeStatement employee={e} employerName={employer.name} lines={history[e.employeeId]} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              );
            })}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell />
              <TableCell colSpan={4}>Total ({shown.length} employee{shown.length === 1 ? "" : "s"}{q ? " shown" : ""})</TableCell>
              <TableCell />
              <TableCell className="text-right tabular-nums">{formatCurrency(sum("totalGross"))}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(sum("totalDeductions"))}</TableCell>
              <TableCell className="text-right tabular-nums">{formatCurrency(sum("totalNet"))}</TableCell>
            </TableRow>
          </TableFooter>
        </ScrollableTable>
      </CardContent>
    </Card>
  );
}
