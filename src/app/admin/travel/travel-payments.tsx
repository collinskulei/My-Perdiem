/**
 * @file Travel & Ground Transfers "Payments" tab: every payment with
 * search and filters, a running total, Excel export, adding a payment by
 * hand and editing one (Organization Admin and above), and deleting
 * payments (Super Admin and above - RLS enforces the same).
 */
"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Download, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  addTravelPayment, deleteTravelPayments, updateTravelPayment,
  type TravelPayment, type TravelPaymentInput,
} from "@/lib/supabase/travel";
import { TRAVEL_TYPES } from "@/lib/travel/fields";
import { formatDate, parseAmount } from "@/lib/hotels/parse";
import { EmptyState } from "../insights/shared";
import { NOT_SPECIFIED, money } from "../hotels/hotels-shared";
import { exportTravelPayments } from "./travel-shared";

const ALL = "__all__";

const EMPTY_INPUT: TravelPaymentInput = {
  description: "", paymentType: "Flight", route: null, supplier: null, eventName: null, travelDate: null,
  paymentDate: "", paymentMethod: "Bank Transfer", reference: null, amount: 0, notes: null,
};

function PaymentFormDialog({ initial, title, suggestions, onClose, onSave }: {
  initial: TravelPaymentInput;
  title: string;
  suggestions: { types: string[]; routes: string[]; suppliers: string[]; events: string[]; methods: string[] };
  onClose: () => void;
  onSave: (input: TravelPaymentInput) => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [amountText, setAmountText] = useState(initial.amount ? String(initial.amount) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof TravelPaymentInput>(k: K, v: TravelPaymentInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const text = (k: keyof TravelPaymentInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, (e.target.value || null) as any);

  const handleSave = async () => {
    const amount = parseAmount(amountText);
    if (!form.description?.trim()) return setError("Enter a description.");
    if (!form.paymentDate) return setError("Enter the payment date.");
    if (amount === null || amount <= 0) return setError("Enter an amount above zero.");
    setError(null);
    setSaving(true);
    try {
      await onSave({ ...form, amount });
    } catch (e: any) {
      setError(e?.message ?? "Couldn't save the payment.");
    } finally {
      setSaving(false);
    }
  };

  const list = (id: string, values: string[]) => (
    <datalist id={id}>{values.map((v) => <option key={v} value={v} />)}</datalist>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Description, payment date and amount are required.</DialogDescription>
        </DialogHeader>
        {list("travel-types", suggestions.types)}
        {list("travel-routes", suggestions.routes)}
        {list("travel-suppliers", suggestions.suppliers)}
        {list("travel-events", suggestions.events)}
        {list("travel-methods", suggestions.methods)}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="tp-desc">Description *</Label>
            <Input id="tp-desc" value={form.description} onChange={(e) => set("description", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tp-type">Type</Label>
            <Input id="tp-type" list="travel-types" value={form.paymentType ?? ""} onChange={text("paymentType")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tp-route">Route / Venue</Label>
            <Input id="tp-route" list="travel-routes" value={form.route ?? ""} onChange={text("route")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tp-supplier">Supplier</Label>
            <Input id="tp-supplier" list="travel-suppliers" value={form.supplier ?? ""} onChange={text("supplier")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tp-event">Event</Label>
            <Input id="tp-event" list="travel-events" value={form.eventName ?? ""} onChange={text("eventName")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tp-travel">Travel Date</Label>
            <Input id="tp-travel" type="date" value={form.travelDate ?? ""} onChange={text("travelDate")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tp-paid">Payment Date *</Label>
            <Input id="tp-paid" type="date" value={form.paymentDate} onChange={(e) => set("paymentDate", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tp-amount">Amount (KES) *</Label>
            <Input id="tp-amount" inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="tp-method">Payment Method</Label>
            <Input id="tp-method" list="travel-methods" value={form.paymentMethod ?? ""} onChange={text("paymentMethod")} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="tp-ref">Reference / Ticket No</Label>
            <Input id="tp-ref" value={form.reference ?? ""} onChange={text("reference")} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="tp-notes">Notes</Label>
            <Textarea id="tp-notes" rows={2} value={form.notes ?? ""} onChange={text("notes")} />
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

export function TravelPayments({ clientId, clientName, payments, canDelete, onChanged }: {
  clientId: string;
  clientName: string;
  payments: TravelPayment[];
  canDelete: boolean;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [type, setType] = useState(ALL);
  const [editing, setEditing] = useState<TravelPayment | "new" | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const uniq = (vals: (string | null)[]) => Array.from(new Set(vals.filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  const suggestions = useMemo(() => ({
    types: uniq([...TRAVEL_TYPES, ...payments.map((p) => p.paymentType)]),
    routes: uniq(payments.map((p) => p.route)),
    suppliers: uniq(payments.map((p) => p.supplier)),
    events: uniq(payments.map((p) => p.eventName)),
    methods: uniq(payments.map((p) => p.paymentMethod)),
  }), [payments]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return payments.filter((p) => {
      if (type !== ALL && (p.paymentType ?? NOT_SPECIFIED) !== type) return false;
      if (!q) return true;
      return [p.description, p.paymentType, p.route, p.supplier, p.eventName, p.reference, p.notes, p.paymentMethod]
        .some((v) => v?.toLowerCase().includes(q));
    });
  }, [payments, query, type]);

  const total = shown.reduce((acc, p) => acc + p.amount, 0);
  const typeOptions = useMemo(() => uniq(payments.map((p) => p.paymentType ?? NOT_SPECIFIED)), [payments]);

  const allShownSelected = shown.length > 0 && shown.every((p) => selected.has(p.id));
  const toggleAll = () => setSelected(allShownSelected ? new Set() : new Set(shown.map((p) => p.id)));
  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const handleSave = async (input: TravelPaymentInput) => {
    if (editing === "new") {
      await addTravelPayment(clientId, input);
      toast({ title: "Payment added", description: `${input.description} · KES ${money(input.amount)}` });
    } else if (editing) {
      await updateTravelPayment(editing.id, input);
      toast({ title: "Payment saved", description: input.description });
    }
    setEditing(null);
    onChanged();
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteTravelPayments(Array.from(selected));
      toast({ title: "Payments deleted", description: `${selected.size} payment${selected.size === 1 ? "" : "s"} removed.` });
      setSelected(new Set());
      onChanged();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message ?? "Couldn't delete the payments.", variant: "destructive" });
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const selectedTotal = payments.filter((p) => selected.has(p.id)).reduce((acc, p) => acc + p.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8 w-64" placeholder="Search description, route, supplier..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select value={type} onValueChange={setType}>
          <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All types</SelectItem>
            {typeOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex flex-wrap gap-2">
          {canDelete && selected.size > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete {selected.size}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => exportTravelPayments(shown, clientName)} disabled={shown.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Excel
          </Button>
          <Button size="sm" onClick={() => setEditing("new")}>
            <Plus className="mr-2 h-4 w-4" />
            Add payment
          </Button>
        </div>
      </div>

      {shown.length === 0 ? (
        <EmptyState message={payments.length === 0 ? "No travel payments on file yet." : "No payments match these filters."} />
      ) : (
        <ScrollableTable containerClassName="max-h-[65vh] border rounded-md" stickyHeader aria-label="Travel payments">
          <TableHeader>
            <TableRow>
              {canDelete && (
                <TableHead className="w-8">
                  <Checkbox checked={allShownSelected} onCheckedChange={toggleAll} aria-label="Select all shown" />
                </TableHead>
              )}
              <TableHead>Paid On</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Route / Venue</TableHead>
              <TableHead>Supplier</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Travel Date</TableHead>
              <TableHead className="text-right">Amount (KES)</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((p) => (
              <TableRow key={p.id} data-state={selected.has(p.id) ? "selected" : undefined}>
                {canDelete && (
                  <TableCell>
                    <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} aria-label={`Select ${p.description}`} />
                  </TableCell>
                )}
                <TableCell className="whitespace-nowrap">{formatDate(p.paymentDate)}</TableCell>
                <TableCell className="font-medium max-w-xs">
                  {p.description}
                  {p.warnings.length > 0 && (
                    <span title={p.warnings.join("\n")}>
                      <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-amber-500" />
                    </span>
                  )}
                </TableCell>
                <TableCell className="whitespace-nowrap">{p.paymentType ?? <span className="text-muted-foreground">{NOT_SPECIFIED}</span>}</TableCell>
                <TableCell>{p.route ?? "-"}</TableCell>
                <TableCell>{p.supplier ?? "-"}</TableCell>
                <TableCell>{p.eventName ?? "-"}</TableCell>
                <TableCell className="whitespace-nowrap">{formatDate(p.travelDate) || "-"}</TableCell>
                <TableCell className="text-right tabular-nums">{money(p.amount)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(p)} aria-label={`Edit ${p.description}`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={canDelete ? 8 : 7}>
                {shown.length} payment{shown.length === 1 ? "" : "s"}
                {shown.length !== payments.length ? ` of ${payments.length}` : ""}
              </TableCell>
              <TableCell className="text-right tabular-nums">{money(total)}</TableCell>
              <TableCell />
            </TableRow>
          </TableFooter>
        </ScrollableTable>
      )}

      {editing !== null && (
        <PaymentFormDialog
          key={editing === "new" ? "new" : editing.id}
          title={editing === "new" ? "Add travel payment" : "Edit travel payment"}
          initial={editing === "new" ? EMPTY_INPUT : editing}
          suggestions={suggestions}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      <AlertDialog open={confirmDelete} onOpenChange={(o) => !deleting && setConfirmDelete(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} payment{selected.size === 1 ? "" : "s"}?</AlertDialogTitle>
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
