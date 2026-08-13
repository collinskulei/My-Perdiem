/**
 * @file Milestone 4: historical events + per-diem payment import.
 *
 * Real sample files (see 0007_historical_import_fixes.sql) turned out to be
 * simple bulk-payment lists - NAME, PHONE NUMBER, AMOUNT, DESCRIPTION - with
 * no event/venue/date columns at all, since one such file is one payment
 * batch for one event. Event/venue/date/status are entered once per upload
 * ("batch details") instead of guessed from columns that don't exist; a row
 * can still override them via its own mapped column if a file does carry
 * multiple events in one sheet (already supported - see buildRows below).
 *
 * Later real files turned out to also have multiple sheets (e.g. one per
 * quarter) and a few title rows before the real header row, instead of a
 * single sheet with headers on row 1 - handleFile/detectHeaderRow below
 * auto-detect both (sheet picker only shown if more than one non-empty
 * sheet exists; header row picked by scoring which row best matches known
 * field patterns, not assumed to be row 1).
 *
 * Column mapping is still user-confirmed, not blindly trusted even after
 * auto-detection - upload -> [pick sheet, if >1] -> batch details -> mapping
 * -> preview with per-row validation -> confirm. Import itself is one atomic
 * RPC call (import_historical_events) - all rows commit or none do.
 */
"use client";

import { useState, useCallback } from "react";
import * as XLSX from "xlsx";
import { Loader2, Upload, AlertTriangle, CheckCircle2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import * as supabaseDb from "@/lib/supabase/database";
import type { HistoricalImportRow } from "@/lib/supabase/database";

type FieldKey =
  | "eventName" | "venueName" | "venueCity" | "venueCounty"
  | "participantName" | "participantPhone" | "participantIdNumber"
  | "status" | "transactionCode" | "notes" | "totalPerdiem"
  | "mileageKm" | "mileageTotal" | "accommodationNights" | "accommodationTotal"
  | "outOfOfficeAllowance" | "airTicketCost" | "groundTransferCost";

const FIELD_LABELS: Record<FieldKey, string> = {
  eventName: "Event Name (overrides batch default)",
  venueName: "Venue Name (overrides batch default)",
  venueCity: "Venue City",
  venueCounty: "Venue County",
  participantName: "Participant Name *",
  participantPhone: "Phone Number",
  participantIdNumber: "ID Number",
  status: "Status (overrides batch default)",
  transactionCode: "Transaction Code",
  notes: "Notes / Description",
  totalPerdiem: "Amount / Total Per Diem *",
  mileageKm: "Mileage (km)",
  mileageTotal: "Mileage Total",
  accommodationNights: "Accommodation Nights",
  accommodationTotal: "Accommodation Total",
  outOfOfficeAllowance: "Out of Office Allowance",
  airTicketCost: "Air Ticket Cost",
  groundTransferCost: "Ground Transfer Cost",
};

const REQUIRED_COLUMN_FIELDS: FieldKey[] = ["participantName", "totalPerdiem"];

// Ordered so more specific patterns (e.g. "id number") are tried before
// looser ones (e.g. bare "id", which would otherwise also match "Paid").
const HEADER_GUESSES: [FieldKey, RegExp][] = [
  ["participantIdNumber", /id\s*number|national\s*id/],
  ["participantPhone", /phone|mobile|msisdn/],
  ["eventName", /event/],
  ["venueCity", /city/],
  ["venueCounty", /county/],
  ["venueName", /venue/],
  ["participantName", /name/],
  ["status", /status/],
  ["transactionCode", /transaction|reference|mpesa|code/],
  ["notes", /description|notes|remarks|purpose/],
  ["mileageKm", /mileage.*km|km/],
  ["mileageTotal", /mileage/],
  ["accommodationNights", /night/],
  ["accommodationTotal", /accommodation/],
  ["outOfOfficeAllowance", /out.of.office|allowance/],
  ["airTicketCost", /ticket|flight|air/],
  ["groundTransferCost", /transfer|taxi|ground/],
  ["totalPerdiem", /perdiem|per.diem|dsa|total|amount/],
  ["participantIdNumber", /\bid\b/],
];

function guessMapping(headers: string[]): Partial<Record<FieldKey, number>> {
  const mapping: Partial<Record<FieldKey, number>> = {};
  for (const [field, pattern] of HEADER_GUESSES) {
    if (mapping[field] !== undefined) continue;
    const idx = headers.findIndex((h) => typeof h === "string" && pattern.test(h.toLowerCase()));
    if (idx !== -1) mapping[field] = idx;
  }
  return mapping;
}

/** Real files aren't always a single sheet with headers on row 1 - some
 * have title/blank rows before the real header row. Scans the first 20
 * rows and picks whichever one guessMapping() matches the most known
 * fields against, so title rows (which match nothing) are skipped
 * automatically. Falls back to row 0 if nothing scores >=2 matches,
 * preserving the original behavior for already-well-formed files. */
function detectHeaderRow(rows: any[][]): number {
  let bestIdx = 0;
  let bestScore = 0;
  for (let i = 0; i < Math.min(20, rows.length); i++) {
    const candidate = (rows[i] ?? []).map((h) => String(h ?? ""));
    const score = Object.keys(guessMapping(candidate)).length;
    if (score > bestScore) {
      bestScore = score;
      bestIdx = i;
    }
  }
  return bestScore >= 2 ? bestIdx : 0;
}

/** A sheet with no real data (just title rows, or nothing) shouldn't clutter
 * a sheet picker - "does any row have 2+ non-empty cells" is enough to tell
 * an empty/title-only sheet apart from one with actual tabular data. */
function sheetHasData(ws: XLSX.WorkSheet): boolean {
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
  return rows.some((r) => r.filter((c) => String(c).trim() !== "").length >= 2);
}

function splitDates(raw: unknown): string[] {
  if (raw === null || raw === undefined || raw === "") return [];
  return String(raw).split(/[,;|]/).map((d) => d.trim()).filter(Boolean);
}

/** Normalizes to the app's +254XXXXXXXXX convention regardless of input
 * format (07XXXXXXXX, 7XXXXXXXX, 2547XXXXXXXX, +2547XXXXXXXX all resolve to
 * the same value) - matches what registered participants store, so the RPC's
 * last-9-digit match actually lines up with real data either way. */
function normalizePhone(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 9) return `+254${digits.slice(-9)}`;
  return raw.trim() || undefined;
}

export type BatchDefaults = {
  eventName: string;
  venueName: string;
  venueCity: string;
  eventDate: string;
  status: string;
  transactionCode: string;
};

type ValidatedRow = { row: HistoricalImportRow; errors: string[] };

function buildRows(
  dataRows: any[][],
  mapping: Partial<Record<FieldKey, number>>,
  dateColumnIndexes: number[],
  defaults: BatchDefaults
): ValidatedRow[] {
  return dataRows
    .filter((r) => r.some((cell) => cell !== undefined && cell !== ""))
    .map((r) => {
      const get = (field: FieldKey): string | undefined => {
        const idx = mapping[field];
        if (idx === undefined) return undefined;
        const v = r[idx];
        return v === undefined || v === "" ? undefined : String(v).trim();
      };
      const getNum = (field: FieldKey): number | undefined => {
        const v = get(field);
        if (v === undefined) return undefined;
        const n = Number(v);
        return Number.isFinite(n) ? n : undefined;
      };

      const rowDates = dateColumnIndexes.flatMap((idx) => splitDates(r[idx]));
      const eventDates = rowDates.length > 0 ? rowDates : (defaults.eventDate ? [defaults.eventDate] : undefined);

      const row: HistoricalImportRow = {
        eventName: get("eventName") ?? defaults.eventName,
        venueName: get("venueName") ?? defaults.venueName ?? undefined,
        venueCity: get("venueCity") ?? defaults.venueCity ?? undefined,
        venueCounty: get("venueCounty"),
        eventDates,
        participantName: get("participantName") ?? "",
        participantPhone: normalizePhone(get("participantPhone")),
        participantIdNumber: get("participantIdNumber"),
        status: get("status") ?? defaults.status ?? "Paid",
        transactionCode: get("transactionCode") ?? defaults.transactionCode ?? undefined,
        notes: get("notes"),
        totalPerdiem: getNum("totalPerdiem") ?? NaN,
        mileageKm: getNum("mileageKm"),
        mileageTotal: getNum("mileageTotal"),
        accommodationNights: getNum("accommodationNights"),
        accommodationTotal: getNum("accommodationTotal"),
        outOfOfficeAllowance: getNum("outOfOfficeAllowance"),
        airTicketCost: getNum("airTicketCost"),
        groundTransferCost: getNum("groundTransferCost"),
      };

      const errors: string[] = [];
      if (!row.eventName) errors.push("Missing event name (set a batch default or map a column)");
      if (!row.participantName) errors.push("Missing participant name");
      if (Number.isNaN(row.totalPerdiem)) errors.push("Missing/invalid amount");

      return { row, errors };
    });
}

export function HistoricalImportDialog({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [step, setStep] = useState<"upload" | "details" | "map" | "preview">("upload");
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [sheetOptions, setSheetOptions] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [dataRows, setDataRows] = useState<any[][]>([]);
  const [mapping, setMapping] = useState<Partial<Record<FieldKey, number>>>({});
  const [dateColumns, setDateColumns] = useState<Set<number>>(new Set());
  const [defaults, setDefaults] = useState<BatchDefaults>({
    eventName: "", venueName: "", venueCity: "", eventDate: "", status: "Paid", transactionCode: "",
  });
  const [isImporting, setIsImporting] = useState(false);
  const [result, setResult] = useState<{ importedCount: number; eventCount: number } | null>(null);

  const reset = () => {
    setStep("upload");
    setWorkbook(null);
    setSheetOptions([]);
    setSelectedSheet("");
    setHeaders([]);
    setDataRows([]);
    setMapping({});
    setDateColumns(new Set());
    setDefaults({ eventName: "", venueName: "", venueCity: "", eventDate: "", status: "Paid", transactionCode: "" });
    setResult(null);
  };

  /** Reads the chosen sheet out of the already-loaded workbook, auto-detects
   * the real header row (skipping any title/blank rows above it), and moves
   * on to batch details. Shared by the single-sheet auto-advance path and
   * the multi-sheet picker's "Next" button. */
  const loadSheet = useCallback((wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" }) as any[][];
    const headerIdx = detectHeaderRow(data);
    const hdrs = (data[headerIdx] ?? []).map((h) => String(h ?? "").trim());
    const rows = data.slice(headerIdx + 1);
    setHeaders(hdrs);
    setDataRows(rows);
    setMapping(guessMapping(hdrs));
    const guessedDateCol = hdrs.findIndex((h) => /date/i.test(h));
    setDateColumns(guessedDateCol !== -1 ? new Set([guessedDateCol]) : new Set());
    setStep("details");
  }, []);

  const handleFile = useCallback((file: File) => {
    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: "binary" });
      const nonEmptySheets = wb.SheetNames.filter((name) => sheetHasData(wb.Sheets[name]));

      if (nonEmptySheets.length === 0) {
        toast({ title: "No data found", description: "This file doesn't seem to have any rows in it.", variant: "destructive" });
        return;
      }

      setWorkbook(wb);
      if (nonEmptySheets.length === 1) {
        loadSheet(wb, nonEmptySheets[0]);
      } else {
        // Multiple sheets (e.g. one per quarter) - let the user pick which
        // one this upload is for, rather than silently guessing.
        setSheetOptions(nonEmptySheets);
        setSelectedSheet(nonEmptySheets[0]);
      }
    };
    reader.readAsBinaryString(file);
  }, [loadSheet, toast]);

  const validated = buildRows(dataRows, mapping, Array.from(dateColumns), defaults);
  const validRows = validated.filter((v) => v.errors.length === 0);
  const invalidRows = validated.filter((v) => v.errors.length > 0);

  const handleConfirmImport = async () => {
    setIsImporting(true);
    try {
      const res = await supabaseDb.importHistoricalEvents(clientId, validRows.map((v) => v.row));
      setResult(res);
      toast({ title: "Import complete", description: `${res.importedCount} payment records imported across ${res.eventCount} events.` });
    } catch (error: any) {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { setIsOpen(open); if (!open) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" onClick={(e) => e.stopPropagation()}>
          <Upload className="mr-2 h-4 w-4" />
          Import Historical Data
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>Import Historical Data for {clientName}</DialogTitle>
          <DialogDescription>
            Upload a spreadsheet of past per-diem payments. Nothing is written to the database until you confirm on the final step.
          </DialogDescription>
        </DialogHeader>

        {step === "upload" && (
          <div className="py-6 space-y-4">
            <div>
              <Label htmlFor="historical-file">Excel or CSV file</Label>
              <input
                id="historical-file"
                type="file"
                accept=".xlsx,.xls,.csv"
                className="mt-2 block w-full text-sm"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                }}
              />
            </div>
            {sheetOptions.length > 1 && (
              <div className="space-y-3 rounded-md border p-3">
                <p className="text-sm text-muted-foreground">
                  This file has {sheetOptions.length} sheets - pick the one to import. You can upload the others separately afterward.
                </p>
                <Select value={selectedSheet} onValueChange={setSelectedSheet}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {sheetOptions.map((name) => (
                      <SelectItem key={name} value={name}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button onClick={() => workbook && loadSheet(workbook, selectedSheet)} disabled={!selectedSheet}>
                  Next
                </Button>
              </div>
            )}
          </div>
        )}

        {step === "details" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Most historical files are one payment batch for one event, with no event/venue/date columns in the
              sheet itself - fill those in once here. A row can still override any of these if you map a column for
              it in the next step.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Event Name *</Label>
                <Input value={defaults.eventName} onChange={(e) => setDefaults((d) => ({ ...d, eventName: e.target.value }))} placeholder="e.g. Embu CHP Training - Sept 2025" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Event Date</Label>
                <Input type="date" value={defaults.eventDate} onChange={(e) => setDefaults((d) => ({ ...d, eventDate: e.target.value }))} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Venue Name</Label>
                <Input value={defaults.venueName} onChange={(e) => setDefaults((d) => ({ ...d, venueName: e.target.value }))} placeholder="e.g. Embu CHP" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Venue City</Label>
                <Input value={defaults.venueCity} onChange={(e) => setDefaults((d) => ({ ...d, venueCity: e.target.value }))} placeholder="e.g. Embu" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Status</Label>
                <Select value={defaults.status} onValueChange={(v) => setDefaults((d) => ({ ...d, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Paid">Paid</SelectItem>
                    <SelectItem value="Approved">Approved</SelectItem>
                    <SelectItem value="Pending">Pending</SelectItem>
                    <SelectItem value="Rejected">Rejected</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Batch Transaction/Reference Code</Label>
                <Input value={defaults.transactionCode} onChange={(e) => setDefaults((d) => ({ ...d, transactionCode: e.target.value }))} placeholder="e.g. bank batch ref" />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={reset}>Back</Button>
              <Button onClick={() => setStep("map")} disabled={!defaults.eventName.trim()}>Next: Map Columns</Button>
            </DialogFooter>
          </div>
        )}

        {step === "map" && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              Columns were guessed from your headers - check each one and fix any that are wrong. Fields marked * are required.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(Object.keys(FIELD_LABELS) as FieldKey[]).map((field) => (
                <div key={field} className="space-y-1">
                  <Label className="text-xs">{FIELD_LABELS[field]}</Label>
                  <Select
                    value={mapping[field] !== undefined ? String(mapping[field]) : "none"}
                    onValueChange={(v) => setMapping((m) => ({ ...m, [field]: v === "none" ? undefined : Number(v) }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— None —</SelectItem>
                      {headers.map((h, i) => (
                        <SelectItem key={i} value={String(i)}>{h || `Column ${i + 1}`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
              <div className="space-y-1 sm:col-span-2">
                <Label className="text-xs">Event Date Column(s) - only if the sheet itself has per-row dates</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {headers.map((h, i) => (
                    <Badge
                      key={i}
                      variant={dateColumns.has(i) ? "default" : "outline"}
                      className="cursor-pointer"
                      onClick={() => setDateColumns((prev) => {
                        const next = new Set(prev);
                        next.has(i) ? next.delete(i) : next.add(i);
                        return next;
                      })}
                    >
                      {h || `Column ${i + 1}`}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("details")}>Back</Button>
              <Button
                onClick={() => setStep("preview")}
                disabled={REQUIRED_COLUMN_FIELDS.some((f) => mapping[f] === undefined)}
              >
                Preview
              </Button>
            </DialogFooter>
          </div>
        )}

        {step === "preview" && !result && (
          <div className="space-y-4 py-2">
            <div className="flex gap-4 text-sm">
              <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-4 w-4" />{validRows.length} valid rows</span>
              {invalidRows.length > 0 && (
                <span className="flex items-center gap-1 text-destructive"><AlertTriangle className="h-4 w-4" />{invalidRows.length} rows will be skipped</span>
              )}
            </div>
            <div className="overflow-x-auto max-h-64 border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Event</TableHead>
                    <TableHead>Participant</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {validated.slice(0, 50).map((v, i) => (
                    <TableRow key={i} className={v.errors.length > 0 ? "bg-destructive/5" : undefined}>
                      <TableCell>{v.row.eventName || <span className="text-destructive">missing</span>}</TableCell>
                      <TableCell>{v.row.participantName || <span className="text-destructive">missing</span>}</TableCell>
                      <TableCell>{v.row.participantPhone ?? "—"}</TableCell>
                      <TableCell>{Number.isNaN(v.row.totalPerdiem) ? <span className="text-destructive">invalid</span> : v.row.totalPerdiem}</TableCell>
                      <TableCell>
                        {v.errors.length > 0 ? (
                          <Badge variant="destructive">{v.errors[0]}</Badge>
                        ) : (
                          <Badge variant="secondary">{v.row.status}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {validated.length > 50 && (
              <p className="text-xs text-muted-foreground">Showing first 50 of {validated.length} rows.</p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setStep("map")}>Back</Button>
              <Button onClick={handleConfirmImport} disabled={isImporting || validRows.length === 0}>
                {isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Import {validRows.length} Records
              </Button>
            </DialogFooter>
          </div>
        )}

        {result && (
          <div className="py-6 text-center space-y-2">
            <CheckCircle2 className="h-10 w-10 text-green-600 mx-auto" />
            <p className="font-medium">Imported {result.importedCount} payment records across {result.eventCount} events.</p>
            <Button onClick={() => setIsOpen(false)}>Done</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
