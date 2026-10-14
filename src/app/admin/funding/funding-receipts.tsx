/**
 * @file Funding & Refunds "Receipts" tab: every amount received, with
 * search, a running total, Excel export, adding and editing a receipt
 * (Organization Admin and above) and deleting receipts (Super Admin and
 * above - RLS enforces the same).
 */
"use client";

import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { Download, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollableTable } from "@/components/ui/scrollable-table";
import { TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  addFundingReceipt, deleteFundingReceipts, updateFundingReceipt,
  type FundingReceipt, type FundingReceiptInput,
} from "@/lib/supabase/funding";
import { formatDate, parseAmount } from "@/lib/hotels/parse";
import { EmptyState } from "../insights/shared";
import { money } from "../hotels/hotels-shared";

const EMPTY_INPUT: FundingReceiptInput = {
  invoiceNo: null, description: "", payer: null, amount: 0, receivedDate: "", reference: null, notes: null,
};

function exportReceipts(receipts: FundingReceipt[], clientName: string) {
  const header = ["Invoice No", "Description", "Payer", "Amount (KES)", "Reference", "Date Received", "Notes"];
  const rows = receipts.map((r) => [
    r.invoiceNo ?? "", r.description, r.payer ?? "", r.amount, r.reference ?? "N/A", formatDate(r.receivedDate), r.notes ?? "",
  ]);
  const total = ["", "", "TOTAL", receipts.reduce((acc, r) => acc + r.amount, 0), "", "", ""];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[`${clientName} - Funding & refunds received`], header, ...rows, total]), "Receipts");
  XLSX.writeFile(wb, `${(clientName || "client").replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "-")}_funding-receipts.xlsx`);
}

function ReceiptFormDialog({ initial, title, suggestions, onClose, onSave }: {
  initial: FundingReceiptInput;
  title: string;
  suggestions: { descriptions: string[]; payers: string[] };
  onClose: () => void;
  onSave: (input: FundingReceiptInput) => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [amountText, setAmountText] = useState(initial.amount ? String(initial.amount) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof FundingReceiptInput>(k: K, v: FundingReceiptInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const text = (k: keyof FundingReceiptInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, (e.target.value || null) as any);

  const handleSave = async () => {
    const amount = parseAmount(amountText);
    if (!form.description?.trim()) return setError("Enter a description.");
    if (!form.receivedDate) return setError("Enter the date received.");
    if (amount === null || amount <= 0) return setError("Enter an amount above zero.");
    setError(null);
    setSaving(true);
    try {
      await onSave({ ...form, amount });
    } catch (e: any) {
      setError(e?.message ?? "Couldn't save the receipt.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Description, date received and amount are required.</DialogDescription>
        </DialogHeader>
        <datalist id="funding-descriptions">{suggestions.descriptions.map((v) => <option key={v} value={v} />)}</datalist>
        <datalist id="funding-payers">{suggestions.payers.map((v) => <option key={v} value={v} />)}</datalist>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="fr-invoice">Invoice No</Label>
            <Input id="fr-invoice" value={form.invoiceNo ?? ""} onChange={text("invoiceNo")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fr-payer">Received From</Label>
            <Input id="fr-payer" list="funding-payers" value={form.payer ?? ""} onChange={text("payer")} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="fr-desc">Description *</Label>
            <Input id="fr-desc" list="funding-descriptions" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fr-date">Date Received *</Label>
            <Input id="fr-date" type="date" value={form.receivedDate} onChange={(e) => set("receivedDate", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="fr-amount">Amount (KES) *</Label>
            <Input id="fr-amount" inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="fr-ref">Reference</Label>
            <Input id="fr-ref" placeholder="Bank / transaction reference (leave blank if N/A)" value={form.reference ?? ""} onChange={text("reference")} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="fr-notes">Notes</Label>
            <Textarea id="fr-notes" rows={2} value={form.notes ?? ""} onChange={text("notes")} />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function FundingReceipts({ clientId, clientName, receipts, canDelete, onChanged }: {
  clientId: string;
  clientName: string;
  receipts: FundingReceipt[];
  canDelete: boolean;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<FundingReceipt | "new" | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const uniq = (vals: (string | null)[]) => Array.from(new Set(vals.filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  const suggestions = useMemo(() => ({
    descriptions: uniq(receipts.map((r) => r.description)),
    payers: uniq(receipts.map((r) => r.payer)),
  }), [receipts]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return receipts;
    return receipts.filter((r) => [r.invoiceNo, r.description, r.payer, r.reference, r.notes].some((v) => v?.toLowerCase().includes(q)));
  }, [receipts, query]);

  const total = shown.reduce((acc, r) => acc + r.amount, 0);
  const allShownSelected = shown.length > 0 && shown.every((r) => selected.has(r.id));
  const toggleAll = () => setSelected(allShownSelected ? new Set() : new Set(shown.map((r) => r.id)));
  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const handleSave = async (input: FundingReceiptInput) => {
    if (editing === "new") {
      await addFundingReceipt(clientId, input);
      toast({ title: "Receipt added", description: `${input.invoiceNo ?? input.description} · KES ${money(input.amount)}` });
    } else if (editing) {
      await updateFundingReceipt(editing.id, input);
      toast({ title: "Receipt saved", description: input.invoiceNo ?? input.description });
    }
    setEditing(null);
    onChanged();
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteFundingReceipts(Array.from(selected));
      toast({ title: "Receipts deleted", description: `${selected.size} receipt${selected.size === 1 ? "" : "s"} removed.` });
      setSelected(new Set());
      onChanged();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message ?? "Couldn't delete the receipts.", variant: "destructive" });
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const selectedTotal = receipts.filter((r) => selected.has(r.id)).reduce((acc, r) => acc + r.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8 w-64" placeholder="Search invoice, description, payer..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="ml-auto flex flex-wrap gap-2">
          {canDelete && selected.size > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete {selected.size}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => exportReceipts(shown, clientName)} disabled={shown.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Excel
          </Button>
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="mr-2 h-4 w-4" />
            Add receipt
          </Button>
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState message={receipts.length === 0 ? "No money received on file yet." : "No receipts match this search."} />
      ) : (
        <ScrollableTable containerClassName="max-h-[65vh] border rounded-md" stickyHeader aria-label="Funding receipts">
          <TableHeader>
            <TableRow>
              {canDelete && (
                <TableHead className="w-8">
                  <Checkbox checked={allShownSelected} onCheckedChange={toggleAll} aria-label="Select all shown" />
                </TableHead>
              )}
              <TableHead>Invoice No</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Received From</TableHead>
              <TableHead>Reference</TableHead>
              <TableHead>Date Received</TableHead>
              <TableHead className="text-right">Amount (KES)</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((r) => (
              <TableRow key={r.id} data-state={selected.has(r.id) ? "selected" : undefined}>
                {canDelete && (
                  <TableCell>
                    <Checkbox checked={selected.has(r.id)} onCheckedChange={() => toggle(r.id)} aria-label={`Select ${r.invoiceNo ?? r.description}`} />
                  </TableCell>
                )}
                <TableCell className="font-medium whitespace-nowrap">{r.invoiceNo ?? "-"}</TableCell>
                <TableCell>
                  {r.description}
                  {r.notes && <span className="block text-xs text-muted-foreground">{r.notes}</span>}
                </TableCell>
                <TableCell>{r.payer ?? "-"}</TableCell>
                <TableCell>{r.reference ?? <span className="text-muted-foreground">N/A</span>}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDate(r.receivedDate)}</TableCell>
                <TableCell className="text-right tabular-nums">{money(r.amount)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(r)} aria-label={`Edit ${r.invoiceNo ?? r.description}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={canDelete ? 6 : 5}>
                {shown.length} receipt{shown.length === 1 ? "" : "s"}
                {shown.length !== receipts.length ? ` of ${receipts.length}` : ""}
              </TableCell>
              <TableCell className="text-right tabular-nums">{money(total)}</TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </ScrollableTable>
      )}

      {editing !== null && (
        <ReceiptFormDialog
          key={editing === "new" ? "new" : editing.id}
          title={editing === "new" ? "Add receipt" : "Edit receipt"}
          initial={editing === "new" ? EMPTY_INPUT : editing}
          suggestions={suggestions}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      <AlertDialog open={confirmDelete} onOpenChange={(o) => !deleting && setConfirmDelete(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} receipt{selected.size === 1 ? "" : "s"}?</AlertDialogTitle>
            <AlertDialogDescription>
              KES {money(selectedTotal)} will be removed from the records. This can&apos;t be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); handleDelete(); }} disabled={deleting}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
