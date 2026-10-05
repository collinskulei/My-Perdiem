/**
 * @file Salary Payments "Employees" tab: everyone an employer has paid, by
 * Staff No as it appears in the files, with a month-by-month history.
 */
"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollableTable } from "@/components/ui/scrollable-table";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import {
  getSalaryEmployeeHistory, getSalaryEmployeeSummaries,
  type SalaryEmployeeSummary, type SalaryEmployer, type SalaryLine,
} from "@/lib/supabase/salary";
import { formatPeriod } from "@/lib/salary/parse";
import { EmptyState } from "../insights/shared";
import { exportTable } from "./salary-shared";

function HistoryDialog({ employee, onClose }: { employee: SalaryEmployeeSummary | null; onClose: () => void }) {
  const [lines, setLines] = useState<SalaryLine[] | null>(null);
  useEffect(() => {
    setLines(null);
    if (employee) getSalaryEmployeeHistory(employee.employeeId).then(setLines);
  }, [employee]);

  return (
    <Dialog open={employee !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{employee?.name}</DialogTitle>
          <DialogDescription>Staff No {employee?.staffNo} · {employee?.monthsPaid} month{employee?.monthsPaid === 1 ? "" : "s"} on file</DialogDescription>
        </DialogHeader>
        {lines === null ? <Loader2 className="h-6 w-6 animate-spin" /> : (
          <ScrollableTable containerClassName="max-h-[60vh] border rounded-md" stickyHeader aria-label="Salary history">
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Gross</TableHead>
                <TableHead className="text-right">PAYE</TableHead>
                <TableHead className="text-right">NSSF</TableHead>
                <TableHead className="text-right">SHIF</TableHead>
                <TableHead className="text-right">Housing Levy</TableHead>
                <TableHead>Other deductions</TableHead>
                <TableHead className="text-right">Net Pay</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lines.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.period ? formatPeriod(l.period) : "-"}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(l.grossPay)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(l.paye)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(l.nssf)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(l.shif)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(l.housingLevy)}</TableCell>
                  <TableCell className="whitespace-normal text-xs">
                    {Object.entries(l.otherDeductions).map(([k, v]) => <p key={k}>{k}: {formatCurrency(v)}</p>)}
                    {Object.keys(l.otherDeductions).length === 0 && "-"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">{formatCurrency(l.netPay)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </ScrollableTable>
        )}
      </DialogContent>
    </Dialog>
  );
}

export function SalaryEmployees({ employer, refreshKey }: { employer: SalaryEmployer; refreshKey: number }) {
  const [employees, setEmployees] = useState<SalaryEmployeeSummary[] | null>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<SalaryEmployeeSummary | null>(null);

  useEffect(() => {
    setEmployees(null);
    getSalaryEmployeeSummaries(employer.id).then(setEmployees);
  }, [employer.id, refreshKey]);

  if (employees === null) return <Loader2 className="h-6 w-6 animate-spin" />;
  if (employees.length === 0) return <EmptyState message={`No employees on file for ${employer.name} yet.`} />;

  const latestPeriod = employees.reduce((max, e) => (e.lastPeriod && e.lastPeriod > max ? e.lastPeriod : max), "");
  const q = query.trim().toLowerCase();
  const shown = employees.filter((e) => !q || e.staffNo.toLowerCase().includes(q) || e.name.toLowerCase().includes(q));

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
        <div className="space-y-1">
          <CardTitle>Employees - {employer.name}</CardTitle>
          <CardDescription>
            {employees.length} people on file · {employees.filter((e) => e.lastPeriod === latestPeriod).length} paid in{" "}
            {latestPeriod ? formatPeriod(latestPeriod) : "the latest month"}
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
              ["Staff No", "Name", "First Month", "Last Month", "Months Paid", "Latest Gross", "Latest Net", "Total Gross", "Total Net"],
              employees.map((e) => [e.staffNo, e.name, e.firstPeriod ? formatPeriod(e.firstPeriod) : "", e.lastPeriod ? formatPeriod(e.lastPeriod) : "", e.monthsPaid, e.latestGross ?? 0, e.latestNet ?? 0, e.totalGross, e.totalNet]),
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
              <TableHead>Staff No</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>First Month</TableHead>
              <TableHead>Last Month</TableHead>
              <TableHead className="text-right">Months</TableHead>
              <TableHead className="text-right">Latest Gross</TableHead>
              <TableHead className="text-right">Latest Net</TableHead>
              <TableHead className="text-right">Total Net</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((e) => (
              <TableRow key={e.employeeId} className="cursor-pointer" onClick={() => setOpen(e)}>
                <TableCell>{e.staffNo}</TableCell>
                <TableCell className="font-medium">{e.name}</TableCell>
                <TableCell>{e.firstPeriod ? formatPeriod(e.firstPeriod) : "-"}</TableCell>
                <TableCell>
                  {e.lastPeriod ? formatPeriod(e.lastPeriod) : "-"}
                  {e.lastPeriod && e.lastPeriod !== latestPeriod && <span className="ml-1 text-xs text-muted-foreground">(not in latest)</span>}
                </TableCell>
                <TableCell className="text-right tabular-nums">{e.monthsPaid}</TableCell>
                <TableCell className="text-right tabular-nums">{e.latestGross == null ? "-" : formatCurrency(e.latestGross)}</TableCell>
                <TableCell className="text-right tabular-nums">{e.latestNet == null ? "-" : formatCurrency(e.latestNet)}</TableCell>
                <TableCell className="text-right tabular-nums">{formatCurrency(e.totalNet)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </ScrollableTable>
      </CardContent>
      <HistoryDialog employee={open} onClose={() => setOpen(null)} />
    </Card>
  );
}
