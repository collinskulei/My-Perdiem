/**
 * @file "Employers & Templates" (Super Admin and above): the employers a
 * client runs payroll for (e.g. Apeiro -> Digital Health Agency), and each
 * employer's muster-roll template. A template is created by uploading a
 * sample file and confirming how each column is stored; every change is
 * saved as a new version (save_salary_template), so a past upload always
 * points at the mapping it was read with.
 */
"use client";

import { useCallback, useEffect, useState } from "react";
import { Archive, Building, Download, FileSpreadsheet, Loader2, Pencil, PlusCircle, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
  addSalaryEmployer, archiveSalaryEmployer, getSalaryTemplates, saveSalaryTemplate, updateSalaryEmployer,
  type SalaryEmployer,
} from "@/lib/supabase/salary";
import { guessColumn, storedName, type SalaryCoreField, type SalaryTemplate, type SalaryTemplateColumn } from "@/lib/salary/fields";
import { readSalarySheet, templateProblems } from "@/lib/salary/parse";
import { SalaryColumnMapper } from "./salary-column-mapper";
import { downloadBlankTemplate, readWorkbookRows } from "./salary-shared";

type Draft = {
  columns: SalaryTemplateColumn[];
  samples?: unknown[];
  totalsMarker: string;
  sampleFileName: string | null;
  notes: string;
  basedOn: number | null;
};

function TemplateEditorDialog({ employer, draft, onClose, onSaved }: {
  employer: SalaryEmployer;
  draft: Draft | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { toast } = useToast();
  const [columns, setColumns] = useState<SalaryTemplateColumn[]>([]);
  const [totalsMarker, setTotalsMarker] = useState("Grand Totals");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (draft) {
      setColumns(draft.columns);
      setTotalsMarker(draft.totalsMarker);
      setNotes(draft.notes);
    }
  }, [draft]);

  const problems = templateProblems(columns);

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = await saveSalaryTemplate(employer.id, columns, {
        totalsMarker,
        sampleFileName: draft?.sampleFileName ?? null,
        notes: notes.trim() || null,
      });
      toast({ title: `Template v${saved.version} saved`, description: `Uploads for ${employer.name} now use this mapping.` });
      onSaved();
      onClose();
    } catch (error: any) {
      toast({ title: "Could not save template", description: error.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={draft !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{draft?.basedOn ? `Edit template (from v${draft.basedOn})` : "New template"} - {employer.name}</DialogTitle>
          <DialogDescription>
            {draft?.sampleFileName ? `Read from ${draft.sampleFileName}. ` : ""}
            Confirm how each column is stored. Columns that only appear in some months (SACCO, HELB, recoveries...) are
            &quot;Other deduction&quot; or &quot;Other earning&quot; - they&apos;re kept under their own name.
          </DialogDescription>
        </DialogHeader>
        <SalaryColumnMapper columns={columns} onChange={setColumns} samples={draft?.samples} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="totals-marker">Totals row starts with</Label>
            <Input id="totals-marker" value={totalsMarker} onChange={(e) => setTotalsMarker(e.target.value)} />
            <p className="text-xs text-muted-foreground">The file&apos;s own totals row - checked against, never stored as an employee.</p>
          </div>
          <div className="space-y-1">
            <Label htmlFor="template-notes">Notes (optional)</Label>
            <Input id="template-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Added HELB from Mar 2026" />
          </div>
        </div>
        {problems.length > 0 && (
          <Alert variant="destructive">
            <AlertTitle>Fix before saving</AlertTitle>
            <AlertDescription>
              <ul className="list-disc pl-4">{problems.map((p) => <li key={p}>{p}</li>)}</ul>
            </AlertDescription>
          </Alert>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving || problems.length > 0}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save as new version
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EmployerCard({ employer, onChanged }: { employer: SalaryEmployer; onChanged: () => void }) {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<SalaryTemplate[] | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(employer.name);
  const [reading, setReading] = useState(false);

  const load = useCallback(() => {
    getSalaryTemplates(employer.id).then(setTemplates);
  }, [employer.id]);

  useEffect(() => {
    load();
  }, [load]);

  const latest = templates?.[0] ?? null;

  const handleSample = async (file: File) => {
    setReading(true);
    try {
      const rows = await readWorkbookRows(file);
      const sheet = readSalarySheet(rows, file.name, null);
      if (!sheet) {
        toast({ title: "Couldn't find the header row", description: "No row in the first 30 looks like muster-roll headers (Staff No, Employee Name, Basic Pay, Gross Pay, Net Pay...).", variant: "destructive" });
        return;
      }
      const used = new Set<SalaryCoreField>();
      const columns = sheet.headers.map((h) => {
        const c = guessColumn(h, used);
        if (c.kind === "core" && c.field) used.add(c.field);
        return c;
      });
      const firstEmployee = sheet.bodyRows.find((r) => (r ?? []).filter((c) => c !== null && c !== "").length >= 3) ?? [];
      setDraft({ columns, samples: sheet.headers.map((_, i) => firstEmployee[i]), totalsMarker: latest?.totalsMarker ?? "Grand Totals", sampleFileName: file.name, notes: "", basedOn: null });
    } catch (error: any) {
      toast({ title: "Couldn't read that file", description: error.message, variant: "destructive" });
    } finally {
      setReading(false);
    }
  };

  const handleSaveEmployer = async () => {
    try {
      await updateSalaryEmployer(employer.id, { name: name.trim() });
      setEditing(false);
      onChanged();
    } catch (error: any) {
      toast({ title: "Could not save employer", description: error.message, variant: "destructive" });
    }
  };

  const handleArchive = async () => {
    if (!window.confirm(`Archive ${employer.name}? It disappears from Salary Payments; its months stay on record.`)) return;
    try {
      await archiveSalaryEmployer(employer.id);
      onChanged();
    } catch (error: any) {
      toast({ title: "Could not archive employer", description: error.message, variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        {editing ? (
          <div className="flex flex-wrap gap-2 flex-1">
            <Input className="max-w-xs" value={name} onChange={(e) => setName(e.target.value)} aria-label="Employer name" />
            <div className="flex gap-2">
              <Button size="sm" onClick={handleSaveEmployer} disabled={!name.trim()}>Save</Button>
              <Button size="sm" variant="outline" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <CardTitle className="flex items-center gap-2"><Building className="h-5 w-5" />{employer.name}</CardTitle>
        )}
        {!editing && (
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Pencil className="h-4 w-4" /></Button>
            <Button size="sm" variant="ghost" onClick={handleArchive}><Archive className="h-4 w-4" /></Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" asChild disabled={reading}>
            <label className="cursor-pointer">
              {reading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              {latest ? "New template from sample file" : "Upload sample muster roll"}
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = "";
                  if (f) handleSample(f);
                }}
              />
            </label>
          </Button>
          {latest && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDraft({ columns: latest.columns, totalsMarker: latest.totalsMarker, sampleFileName: null, notes: "", basedOn: latest.version })}
              >
                <Pencil className="mr-2 h-4 w-4" />
                Edit mapping
              </Button>
              <Button size="sm" variant="outline" onClick={() => downloadBlankTemplate(latest.columns, latest.totalsMarker, employer.name, latest.version)}>
                <Download className="mr-2 h-4 w-4" />
                Download blank template
              </Button>
            </>
          )}
        </div>

        {templates === null ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No template yet. Upload one of {employer.name}&apos;s muster rolls (e.g. the earliest month) - the columns are read
            from it and you confirm how each one is stored.
          </p>
        ) : (
          <div className="space-y-2">
            {templates.map((t, i) => (
              <div key={t.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 text-sm">
                <div className="flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  <span className="font-medium">v{t.version}</span>
                  {i === 0 && <Badge>Current</Badge>}
                  <span className="text-muted-foreground">
                    {t.columns.filter((c) => c.kind !== "ignore").length} columns
                    {" · "}
                    {t.columns.filter((c) => c.kind === "other_deduction" || c.kind === "other_earning").map(storedName).filter((n, j, all) => all.indexOf(n) === j).join(", ") || "no extra columns"}
                  </span>
                </div>
                <span className="text-xs text-muted-foreground">
                  {new Date(t.createdAt).toLocaleDateString("en-GB")}
                  {t.sampleFileName ? ` · ${t.sampleFileName}` : ""}
                  {t.notes ? ` · ${t.notes}` : ""}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
      <TemplateEditorDialog employer={employer} draft={draft} onClose={() => setDraft(null)} onSaved={load} />
    </Card>
  );
}

export function SalarySetup({ clientId, clientName, employers, onChanged }: {
  clientId: string;
  clientName: string;
  employers: SalaryEmployer[];
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  const handleAdd = async () => {
    if (!name.trim()) return;
    setAdding(true);
    try {
      await addSalaryEmployer(clientId, name.trim());
      setName("");
      onChanged();
    } catch (error: any) {
      toast({ title: "Could not add employer", description: error.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Employers</CardTitle>
          <CardDescription>The organizations {clientName} runs payroll for. Each has its own muster-roll template.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Input className="max-w-xs" placeholder="Employer name, e.g. Digital Health Agency" value={name} onChange={(e) => setName(e.target.value)} />
          <Button variant="outline" onClick={handleAdd} disabled={adding || !name.trim()}>
            {adding ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <PlusCircle className="mr-2 h-4 w-4" />}
            Add employer
          </Button>
        </CardContent>
      </Card>
      {employers.map((e) => <EmployerCard key={e.id} employer={e} onChanged={onChanged} />)}
    </div>
  );
}
