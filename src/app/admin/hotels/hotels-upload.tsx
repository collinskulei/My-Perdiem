/**
 * @file Hotel Bookings upload (hotel payments spreadsheet -> hotel_payments).
 *
 *   1. The header row is found and each column is mapped to a field
 *      (guessed, editable). Columns that aren't a field are kept as extra
 *      columns unless set to Ignore - nothing is silently dropped.
 *   2. Every row is previewed: rows missing a hotel, payment date or
 *      amount are errors and are not imported; rows matching a payment
 *      already on file (same hotel, payment date and amount) or an earlier
 *      row of the file are skipped unless ticked "Import anyway"; a
 *      location or stay dates read from the text are marked as such.
 *   3. The file's TOTAL row, if any, is checked against the rows; a
 *      mismatch must be acknowledged before importing.
 * Past uploads are listed below, and a Super Admin can undo one.
 */
"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, FileSpreadsheet, Loader2, Trash2, Upload, X, XCircle } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollableTable } from "@/components/ui/scrollable-table";
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import {
  deleteHotelImportBatch, getHotelImportBatches, importHotelPayments,
  type HotelImportBatch, type HotelPayment,
} from "@/lib/supabase/hotels";
import {
  HOTEL_FIELDS, HOTEL_FIELD_LABEL, REQUIRED_HOTEL_FIELDS, guessColumns,
  type HotelColumnChoice, type HotelField,
} from "@/lib/hotels/fields";
import {
  buildHotelPayments, formatDate, hotelPaymentKey, readHotelSheet,
  type HotelSheet, type ParsedHotelPayment,
} from "@/lib/hotels/parse";
import { readWorkbookRows } from "../salary/salary-shared";
import { money } from "./hotels-shared";

type Loaded = { fileName: string; sheet: HotelSheet; columns: HotelColumnChoice[] };

type RowStatus =
  | { kind: "error" }
  | { kind: "existing" }
  | { kind: "repeat"; ofRow: number }
  | { kind: "ready" };

const choiceValue = (c: HotelColumnChoice) => (c.kind === "field" ? `field:${c.field}` : c.kind);
const fromValue = (v: string): HotelColumnChoice =>
  v.startsWith("field:") ? { kind: "field", field: v.slice(6) as HotelField } : { kind: v as "extra" | "ignore" };

function sampleOf(sheet: HotelSheet, i: number): string {
  const row = sheet.bodyRows.find((r) => r?.[i] !== null && r?.[i] !== undefined && String(r[i]).trim() !== "");
  const v = row?.[i];
  if (v === null || v === undefined) return "-";
  if (v instanceof Date) return v.toLocaleDateString("en-GB");
  return String(v);
}

function UploadHistory({ clientId, canDelete, refreshKey, onChanged }: {
  clientId: string;
  canDelete: boolean;
  refreshKey: number;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [batches, setBatches] = useState<HotelImportBatch[] | null>(null);
  const [undo, setUndo] = useState<HotelImportBatch | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    getHotelImportBatches(clientId).then(setBatches);
  }, [clientId, refreshKey]);

  const handleUndo = async () => {
    if (!undo) return;
    setDeleting(true);
    try {
      await deleteHotelImportBatch(undo.id);
      toast({ title: "Upload removed", description: `${undo.rowCount} payments from ${undo.sourceFileName ?? "the file"} were deleted.` });
      setUndo(null);
      onChanged();
    } catch (e: any) {
      toast({ title: "Couldn't remove the upload", description: e?.message, variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  if (!batches || batches.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Past uploads</CardTitle>
        {canDelete && (
          <CardDescription>Undoing an upload deletes the payments it added, including any edits made to them since. Payments added by hand aren&apos;t affected.</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <ScrollableTable containerClassName="border rounded-md" aria-label="Past hotel uploads">
          <TableHeader>
            <TableRow>
              <TableHead>File</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead className="text-right">Payments</TableHead>
              <TableHead className="text-right">Amount (KES)</TableHead>
              {canDelete && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.map((b) => (
              <TableRow key={b.id}>
                <TableCell className="font-medium">{b.sourceFileName ?? "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{new Date(b.importedAt).toLocaleString("en-GB")}</TableCell>
                <TableCell className="text-right tabular-nums">{b.rowCount}</TableCell>
                <TableCell className="text-right tabular-nums">{money(b.totalAmount)}</TableCell>
                {canDelete && (
                  <TableCell>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setUndo(b)} aria-label={`Undo upload ${b.sourceFileName ?? ""}`}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </ScrollableTable>
      </CardContent>
      <AlertDialog open={undo !== null} onOpenChange={(o) => !o && !deleting && setUndo(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Undo this upload?</AlertDialogTitle>
            <AlertDialogDescription>
              All {undo?.rowCount} payments (KES {money(undo?.totalAmount ?? 0)}) from {undo?.sourceFileName ?? "this file"} will be deleted,
              including any edits made to them since. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleUndo(); }} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete upload
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

export function HotelsUpload({ clientId, existing, canDelete, onImported, onViewPayments }: {
  clientId: string;
  existing: HotelPayment[];
  canDelete: boolean;
  onImported: () => void;
  onViewPayments: () => void;
}) {
  const { toast } = useToast();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [forced, setForced] = useState<Set<number>>(new Set());
  const [ackTotals, setAckTotals] = useState(false);
  const [ackErrors, setAckErrors] = useState(false);
  const [importing, setImporting] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);

  const reset = () => {
    setLoaded(null);
    setForced(new Set());
    setAckTotals(false);
    setAckErrors(false);
    setReadError(null);
  };

  const handleFile = async (file: File) => {
    reset();
    setReading(true);
    try {
      const rows = await readWorkbookRows(file);
      const sheet = readHotelSheet(rows);
      if (!sheet) {
        setReadError("Couldn't find the header row. The file needs columns for at least two of Hotel, Payment Date and Amount.");
      } else {
        setLoaded({ fileName: file.name, sheet, columns: guessColumns(sheet.headers) });
      }
    } catch (e: any) {
      setReadError(e?.message ?? "Couldn't read the file.");
    } finally {
      setReading(false);
    }
  };

  const missing = useMemo(
    () => (loaded ? REQUIRED_HOTEL_FIELDS.filter((f) => !loaded.columns.some((c) => c.kind === "field" && c.field === f)) : []),
    [loaded]
  );
  const doubled = useMemo(() => {
    if (!loaded) return [];
    const seen = new Map<HotelField, number>();
    loaded.columns.forEach((c) => c.kind === "field" && seen.set(c.field, (seen.get(c.field) ?? 0) + 1));
    return Array.from(seen.entries()).filter(([, n]) => n > 1).map(([f]) => f);
  }, [loaded]);

  const built = useMemo(
    () => (loaded && missing.length === 0 && doubled.length === 0 ? buildHotelPayments(loaded.sheet, loaded.columns) : null),
    [loaded, missing, doubled]
  );

  const existingKeys = useMemo(
    () => new Set(existing.map((p) => hotelPaymentKey(p.hotelName, p.paymentDate, p.amount))),
    [existing]
  );

  const statuses = useMemo((): RowStatus[] => {
    if (!built) return [];
    const firstRowOf = new Map<string, number>();
    return built.payments.map((p) => {
      if (p.errors.length) return { kind: "error" };
      const key = hotelPaymentKey(p.hotelName!, p.paymentDate!, p.amount!);
      if (existingKeys.has(key)) return { kind: "existing" };
      const earlier = firstRowOf.get(key);
      if (earlier !== undefined) return { kind: "repeat", ofRow: earlier };
      firstRowOf.set(key, p.rowNumber);
      return { kind: "ready" };
    });
  }, [built, existingKeys]);

  const toImport = useMemo(() => {
    if (!built) return [] as (ParsedHotelPayment & { force?: boolean })[];
    return built.payments
      .map((p, i) => ({ p, s: statuses[i], i }))
      .filter(({ s, i }) => s.kind === "ready" || ((s.kind === "existing" || s.kind === "repeat") && forced.has(i)))
      .map(({ p, s }) => ({ ...p, force: s.kind !== "ready" }));
  }, [built, statuses, forced]);

  const count = (k: RowStatus["kind"]) => statuses.filter((s) => s.kind === k).length;
  const errorCount = count("error");
  const skippedCount = count("existing") + count("repeat") - forced.size;
  const importTotal = toImport.reduce((acc, p) => acc + (p.amount ?? 0), 0);
  const totalsMismatch = !!built && built.statedTotal !== null && Math.abs(built.statedTotal - built.computedTotal) > 0.5;
  const canImport = toImport.length > 0 && (!totalsMismatch || ackTotals) && (errorCount === 0 || ackErrors) && !importing;

  const handleImport = async () => {
    if (!loaded || !built) return;
    setImporting(true);
    try {
      const res = await importHotelPayments({ clientId, sourceFileName: loaded.fileName, rows: toImport, statedTotal: built.statedTotal });
      toast({
        title: "Hotel payments imported",
        description: `${res.inserted} payment${res.inserted === 1 ? "" : "s"} added${res.skipped.length ? `, ${res.skipped.length} already on file skipped` : ""}.`,
      });
      reset();
      setHistoryKey((k) => k + 1);
      onImported();
    } catch (e: any) {
      toast({ title: "Import failed", description: e?.message ?? "Nothing was imported.", variant: "destructive" });
    } finally {
      setImporting(false);
    }
  };

  const setColumn = (i: number, v: string) =>
    setLoaded((l) => (l ? { ...l, columns: l.columns.map((c, j) => (j === i ? fromValue(v) : c)) } : l));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Upload hotel payments</CardTitle>
          <CardDescription>
            An Excel or CSV list with one payment per row - at least the hotel, payment date and amount. Event, event type,
            description, payment method, location, stay dates and reference are picked up when present.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {loaded ? (
            <div className="flex flex-wrap items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 text-primary" />
              <span className="font-medium">{loaded.fileName}</span>
              <span className="text-sm text-muted-foreground">header on row {loaded.sheet.headerIndex + 1}</span>
              <Button variant="ghost" size="sm" onClick={reset}>
                <X className="mr-1 h-4 w-4" />
                Choose another file
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="max-w-sm"
                disabled={reading}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
              {reading && <Loader2 className="h-5 w-5 animate-spin" />}
            </div>
          )}
          {readError && <p className="text-sm text-destructive">{readError}</p>}
        </CardContent>
      </Card>

      {loaded && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">1. Columns</CardTitle>
            <CardDescription>Check how each column will be stored. Columns that aren&apos;t one of the fields are kept as extra columns unless ignored.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ScrollableTable containerClassName="max-h-[28rem] border rounded-md" stickyHeader aria-label="Column mapping">
              <TableHeader>
                <TableRow>
                  <TableHead>Column in file</TableHead>
                  <TableHead>Example value</TableHead>
                  <TableHead className="w-64">Store as</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loaded.columns.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">
                      {String(loaded.sheet.headers[i] ?? "").trim() || <span className="text-muted-foreground italic">(blank header)</span>}
                    </TableCell>
                    <TableCell className="max-w-xs truncate text-muted-foreground">{sampleOf(loaded.sheet, i)}</TableCell>
                    <TableCell>
                      <Select value={choiceValue(c)} onValueChange={(v) => setColumn(i, v)}>
                        <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {HOTEL_FIELDS.map((f) => (
                            <SelectItem key={f.key} value={`field:${f.key}`}>{f.label}{f.required ? " *" : ""}</SelectItem>
                          ))}
                          <SelectSeparator />
                          <SelectItem value="extra">Keep as extra column</SelectItem>
                          <SelectItem value="ignore">Ignore this column</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </ScrollableTable>
            {missing.length > 0 && (
              <p className="text-sm text-destructive">Choose a column for: {missing.map((f) => HOTEL_FIELD_LABEL[f]).join(", ")}.</p>
            )}
            {doubled.length > 0 && (
              <p className="text-sm text-destructive">More than one column is set to: {doubled.map((f) => HOTEL_FIELD_LABEL[f]).join(", ")}.</p>
            )}
          </CardContent>
        </Card>
      )}

      {built && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">2. Preview</CardTitle>
            <CardDescription className="flex flex-wrap gap-2 pt-1">
              <Badge variant="secondary">{built.payments.length} rows</Badge>
              <Badge className="bg-emerald-600 hover:bg-emerald-600">{toImport.length} to import · KES {money(importTotal)}</Badge>
              {skippedCount > 0 && <Badge variant="outline">{skippedCount} already on file - skipped</Badge>}
              {errorCount > 0 && <Badge variant="destructive">{errorCount} with errors - not imported</Badge>}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {built.statedTotal !== null && (
              totalsMismatch ? (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertTitle>The file&apos;s TOTAL doesn&apos;t match its rows</AlertTitle>
                  <AlertDescription className="space-y-2">
                    <p>TOTAL row: KES {money(built.statedTotal)} · rows add up to: KES {money(built.computedTotal)} (difference KES {money(built.statedTotal - built.computedTotal)}).</p>
                    <div className="flex items-center gap-2">
                      <Checkbox id="ack-totals" checked={ackTotals} onCheckedChange={(v) => setAckTotals(!!v)} />
                      <Label htmlFor="ack-totals">I&apos;ve checked this - import the rows as they are</Label>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : (
                <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Rows add up to the file&apos;s TOTAL of KES {money(built.statedTotal)}.
                </p>
              )
            )}
            {errorCount > 0 && (
              <div className="flex items-center gap-2 text-sm">
                <Checkbox id="ack-errors" checked={ackErrors} onCheckedChange={(v) => setAckErrors(!!v)} />
                <Label htmlFor="ack-errors">
                  Import the other rows and leave out the {errorCount} with errors (fix them in the file and upload again later)
                </Label>
              </div>
            )}

            <ScrollableTable containerClassName="max-h-[60vh] border rounded-md" stickyHeader aria-label="Upload preview">
              <TableHeader>
                <TableRow>
                  <TableHead>Row</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Paid On</TableHead>
                  <TableHead>Hotel</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Event Type</TableHead>
                  <TableHead>Stay / Event Dates</TableHead>
                  <TableHead className="text-right">Amount (KES)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {built.payments.map((p, i) => {
                  const s = statuses[i];
                  return (
                    <TableRow key={p.rowNumber} className={s.kind === "error" ? "bg-destructive/10" : s.kind !== "ready" ? "bg-muted/50" : undefined}>
                      <TableCell className="tabular-nums text-muted-foreground">{p.rowNumber}</TableCell>
                      <TableCell className="min-w-[11rem]">
                        {s.kind === "error" ? (
                          <span className="flex items-start gap-1 text-destructive text-sm">
                            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
                            {p.errors.join("; ")}
                          </span>
                        ) : s.kind === "ready" ? (
                          <span className="flex items-center gap-1 text-sm text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-4 w-4" />
                            Ready
                            {p.warnings.length > 0 && <span title={p.warnings.join("\n")}><AlertTriangle className="h-4 w-4 text-amber-500" /></span>}
                          </span>
                        ) : (
                          <div className="space-y-1 text-sm">
                            <span className="text-muted-foreground">{s.kind === "existing" ? "Already on file" : `Same as row ${s.ofRow}`}</span>
                            <div className="flex items-center gap-1">
                              <Checkbox
                                id={`force-${i}`}
                                checked={forced.has(i)}
                                onCheckedChange={(v) => setForced((prev) => {
                                  const next = new Set(prev);
                                  if (v) next.add(i);
                                  else next.delete(i);
                                  return next;
                                })}
                              />
                              <Label htmlFor={`force-${i}`} className="text-xs font-normal">Import anyway</Label>
                            </div>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{formatDate(p.paymentDate) || "-"}</TableCell>
                      <TableCell className="font-medium">{p.hotelName ?? "-"}</TableCell>
                      <TableCell>
                        {p.location ?? "-"}
                        {p.inferred.location && <span className="ml-1 text-xs text-muted-foreground">(from text)</span>}
                      </TableCell>
                      <TableCell>{p.eventName ?? <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell>{p.eventType ?? <span className="text-muted-foreground">-</span>}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        {p.stayStart ? `${formatDate(p.stayStart)}${p.stayEnd ? ` – ${formatDate(p.stayEnd)}` : ""}` : "-"}
                        {p.inferred.stay && <span className="ml-1 text-xs text-muted-foreground">(from text)</span>}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{p.amount === null ? "-" : money(p.amount)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </ScrollableTable>

            <div className="flex flex-wrap items-center gap-3">
              <Button onClick={handleImport} disabled={!canImport}>
                {importing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Import {toImport.length} payment{toImport.length === 1 ? "" : "s"}
              </Button>
              {toImport.length === 0 && built.payments.length > 0 && errorCount < built.payments.length && (
                <span className="text-sm text-muted-foreground">
                  Everything in this file is already on file.{" "}
                  <button className="underline" onClick={onViewPayments}>View payments</button>
                </span>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <UploadHistory clientId={clientId} canDelete={canDelete} refreshKey={historyKey} onChanged={() => { setHistoryKey((k) => k + 1); onImported(); }} />
    </div>
  );
}
