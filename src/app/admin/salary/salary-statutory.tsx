/**
 * @file Salary Payments "Statutory" tab: what each month owes each
 * authority - PAYE (KRA), NSSF and Housing Levy (employee + employer
 * shares), SHIF, NITA - as recorded in the muster rolls.
 */
"use client";

import { useMemo } from "react";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollableTable } from "@/components/ui/scrollable-table";
import { TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";
import type { SalaryRunSummary } from "@/lib/supabase/salary";
import { EmptyState } from "../insights/shared";
import { exportTable, rollupByPeriod } from "./salary-shared";

const COLUMNS = [
  { key: "paye", label: "PAYE", get: (m: any) => m.paye },
  { key: "nssfEe", label: "NSSF (employee)", get: (m: any) => m.nssf },
  { key: "nssfEr", label: "NSSF (employer)", get: (m: any) => m.employerNssf },
  { key: "shif", label: "SHIF", get: (m: any) => m.shif },
  { key: "hlEe", label: "Housing Levy (employee)", get: (m: any) => m.housingLevy },
  { key: "hlEr", label: "Housing Levy (employer)", get: (m: any) => m.employerHousingLevy },
  { key: "nita", label: "NITA", get: (m: any) => m.employerNita },
] as const;

export function SalaryStatutory({ summaries }: { summaries: SalaryRunSummary[] }) {
  const months = useMemo(() => rollupByPeriod(summaries).reverse(), [summaries]);
  if (months.length === 0) return <EmptyState message="No salary months on file yet." />;

  const total = (m: any) => COLUMNS.reduce((acc, c) => acc + c.get(m), 0);
  const colTotal = (get: (m: any) => number) => months.reduce((acc, m) => acc + get(m), 0);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
        <div className="space-y-1">
          <CardTitle>Statutory Remittances</CardTitle>
          <CardDescription>Per month, as recorded in the muster rolls. NSSF and Housing Levy include the employer&apos;s matching share.</CardDescription>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => exportTable(
            "Statutory Remittances",
            ["Month", ...COLUMNS.map((c) => c.label), "Total"],
            months.map((m) => [m.label, ...COLUMNS.map((c) => c.get(m)), total(m)]),
            "salary-statutory-remittances"
          )}
        >
          <Download className="mr-2 h-4 w-4" />
          Excel
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollableTable aria-label="Statutory remittances">
          <TableHeader>
            <TableRow>
              <TableHead>Month</TableHead>
              {COLUMNS.map((c) => <TableHead key={c.key} className="text-right">{c.label}</TableHead>)}
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {months.map((m) => (
              <TableRow key={m.period}>
                <TableCell className="font-medium">{m.label}</TableCell>
                {COLUMNS.map((c) => <TableCell key={c.key} className="text-right tabular-nums">{formatCurrency(c.get(m))}</TableCell>)}
                <TableCell className="text-right tabular-nums font-semibold">{formatCurrency(total(m))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell>Total</TableCell>
              {COLUMNS.map((c) => <TableCell key={c.key} className="text-right tabular-nums">{formatCurrency(colTotal(c.get))}</TableCell>)}
              <TableCell className="text-right tabular-nums">{formatCurrency(colTotal(total))}</TableCell>
            </TableRow>
          </TableFooter>
        </ScrollableTable>
      </CardContent>
    </Card>
  );
}
