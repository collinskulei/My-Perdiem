/**
 * @file The column-mapping table: one row per file column, with a sample
 * value and a choice of core field / other deduction / other earning /
 * ignore. Used to build an employer's first template (Employers &
 * Templates tab) and to classify columns an upload brings that the
 * template hasn't seen (Upload tab). Other deductions/earnings also get a
 * name - what the amount is stored and shown under.
 */
"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollableTable } from "@/components/ui/scrollable-table";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { storedName, type SalaryTemplateColumn } from "@/lib/salary/fields";
import { COLUMN_CHOICES, applyChoice, columnChoice } from "./salary-shared";

const GROUPS = Array.from(new Set(COLUMN_CHOICES.map((c) => c.group)));

export function SalaryColumnMapper({ columns, onChange, samples, highlight, knownNames }: {
  columns: SalaryTemplateColumn[];
  onChange: (columns: SalaryTemplateColumn[]) => void;
  /** Names already used by the employer's template, offered as suggestions
   * so the same deduction keeps the same name. */
  knownNames?: string[];
  /** Example value per column (same index), shown to help classify. */
  samples?: unknown[];
  /** Column indexes to mark as new. */
  highlight?: Set<number>;
}) {
  const listId = useId();
  const suggestions = Array.from(new Set([
    ...(knownNames ?? []),
    ...columns.filter((c) => c.kind === "other_deduction" || c.kind === "other_earning").map(storedName),
  ])).sort();
  const setColumn = (i: number, col: SalaryTemplateColumn) => onChange(columns.map((c, j) => (j === i ? col : c)));
  return (
    <>
      <datalist id={listId}>
        {suggestions.map((n) => <option key={n} value={n} />)}
      </datalist>
      <ScrollableTable containerClassName="max-h-[28rem] border rounded-md" stickyHeader aria-label="Column mapping">
        <TableHeader>
          <TableRow>
            <TableHead>Column in file</TableHead>
            {samples && <TableHead>Example value</TableHead>}
            <TableHead className="w-72">Store as</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {columns.map((c, i) => (
            <TableRow key={i} className={highlight?.has(i) ? "bg-amber-500/10" : undefined}>
              <TableCell className="font-medium">
                {c.header || <span className="text-muted-foreground italic">(blank header)</span>}
                {highlight?.has(i) && <span className="ml-2 text-xs text-amber-600 dark:text-amber-400">new</span>}
              </TableCell>
              {samples && (
                <TableCell className="text-muted-foreground tabular-nums">
                  {samples[i] === null || samples[i] === undefined || samples[i] === "" ? "-" : String(samples[i])}
                </TableCell>
              )}
              <TableCell>
                <div className="flex flex-col gap-2">
                  <Select
                    value={columnChoice(c)}
                    onValueChange={(v) => setColumn(i, applyChoice(c, v))}
                  >
                    <SelectTrigger className="w-72"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {GROUPS.map((g) => (
                        <SelectGroup key={g}>
                          <SelectLabel>{g}</SelectLabel>
                          {COLUMN_CHOICES.filter((o) => o.group === g).map((o) => (
                            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                  {(c.kind === "other_deduction" || c.kind === "other_earning") && (
                    <Input
                      className="w-72"
                      list={listId}
                      value={c.name ?? c.header}
                      onChange={(e) => setColumn(i, { ...c, name: e.target.value })}
                      placeholder={c.header}
                      aria-label={`Name for ${c.header || "column"}`}
                    />
                  )}
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </ScrollableTable>
    </>
  );
}
