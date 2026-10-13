/**
 * @file Hotel Bookings "Payments" tab: every payment with search and
 * filters, a running total, Excel export, adding a payment by hand and
 * editing one (Organization Admin and above), and deleting payments
 * (Super Admin and above - RLS enforces the same).
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
  addHotelPayment, deleteHotelPayments, updateHotelPayment,
  type HotelPayment, type HotelPaymentInput,
} from "@/lib/supabase/hotels";
import { formatDate, parseAmount } from "@/lib/hotels/parse";
import { EmptyState } from "../insights/shared";
import { NOT_SPECIFIED, exportPayments, groupKey, money } from "./hotels-shared";

const ALL = "__all__";

const EMPTY_INPUT: HotelPaymentInput = {
  eventName: null, eventType: null, hotelName: "", location: null, description: null, stayStart: null,
  stayEnd: null, paymentDate: "", paymentMethod: "Bank Transfer", reference: null, amount: 0, notes: null,
};

function stayText(p: HotelPayment): string {
  if (!p.stayStart) return "";
  return p.stayEnd && p.stayEnd !== p.stayStart ? `${formatDate(p.stayStart)} – ${formatDate(p.stayEnd)}` : formatDate(p.stayStart);
}

function PaymentFormDialog({ open, initial, title, suggestions, onClose, onSave }: {
  open: boolean;
  initial: HotelPaymentInput;
  title: string;
  suggestions: { events: string[]; types: string[]; hotels: string[]; locations: string[]; methods: string[] };
  onClose: () => void;
  onSave: (input: HotelPaymentInput) => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [amountText, setAmountText] = useState(initial.amount ? String(initial.amount) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof HotelPaymentInput>(k: K, v: HotelPaymentInput[K]) => setForm((f) => ({ ...f, [k]: v }));
  const text = (k: keyof HotelPaymentInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => set(k, (e.target.value || null) as any);

  const handleSave = async () => {
    const amount = parseAmount(amountText);
    if (!form.hotelName?.trim()) return setError("Enter the hotel.");
    if (!form.paymentDate) return setError("Enter the payment date.");
    if (amount === null || amount <= 0) return setError("Enter an amount above zero.");
    if (form.stayStart && form.stayEnd && form.stayEnd < form.stayStart) return setError("Stay end is before stay start.");
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
    <Dialog open={open} onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>Hotel, payment date and amount are required.</DialogDescription>
        </DialogHeader>
        {list("hotel-events", suggestions.events)}
        {list("hotel-types", suggestions.types)}
        {list("hotel-hotels", suggestions.hotels)}
        {list("hotel-locations", suggestions.locations)}
        {list("hotel-methods", suggestions.methods)}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="hp-hotel">Hotel *</Label>
            <Input id="hp-hotel" list="hotel-hotels" value={form.hotelName} onChange={(e) => set("hotelName", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hp-event">Event</Label>
            <Input id="hp-event" list="hotel-events" value={form.eventName ?? ""} onChange={text("eventName")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hp-type">Event Type</Label>
            <Input id="hp-type" list="hotel-types" value={form.eventType ?? ""} onChange={text("eventType")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hp-location">Location</Label>
            <Input id="hp-location" list="hotel-locations" value={form.location ?? ""} onChange={text("location")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hp-method">Payment Method</Label>
            <Input id="hp-method" list="hotel-methods" value={form.paymentMethod ?? ""} onChange={text("paymentMethod")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hp-start">Stay / Event Start</Label>
            <Input id="hp-start" type="date" value={form.stayStart ?? ""} onChange={text("stayStart")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hp-end">Stay / Event End</Label>
            <Input id="hp-end" type="date" value={form.stayEnd ?? ""} onChange={text("stayEnd")} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hp-paid">Payment Date *</Label>
            <Input id="hp-paid" type="date" value={form.paymentDate} onChange={(e) => set("paymentDate", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="hp-amount">Amount (KES) *</Label>
            <Input id="hp-amount" inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="hp-ref">Reference / Invoice No</Label>
            <Input id="hp-ref" value={form.reference ?? ""} onChange={text("reference")} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="hp-desc">Description</Label>
            <Textarea id="hp-desc" rows={2} value={form.description ?? ""} onChange={text("description")} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="hp-notes">Notes</Label>
            <Textarea id="hp-notes" rows={2} value={form.notes ?? ""} onChange={text("notes")} />
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

export function HotelsPayments({ clientId, clientName, payments, canDelete, onChanged }: {
  clientId: string;
  clientName: string;
  payments: HotelPayment[];
  canDelete: boolean;
  onChanged: () => void;
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [eventType, setEventType] = useState(ALL);
  const [hotel, setHotel] = useState(ALL);
  const [editing, setEditing] = useState<HotelPayment | "new" | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const uniq = (vals: (string | null)[]) => Array.from(new Set(vals.filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  const suggestions = useMemo(() => ({
    events: uniq(payments.map((p) => p.eventName)),
    types: uniq(payments.map((p) => p.eventType)),
    hotels: uniq(payments.map((p) => p.hotelName)),
    locations: uniq(payments.map((p) => p.location)),
    methods: uniq(payments.map((p) => p.paymentMethod)),
  }), [payments]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return payments.filter((p) => {
      if (eventType !== ALL && (p.eventType ?? NOT_SPECIFIED) !== eventType) return false;
      if (hotel !== ALL && groupKey(p.hotelName) !== hotel) return false;
      if (!q) return true;
      return [p.eventName, p.eventType, p.hotelName, p.location, p.description, p.reference, p.notes, p.paymentMethod]
        .some((v) => v?.toLowerCase().includes(q));
    });
  }, [payments, query, eventType, hotel]);

  const total = shown.reduce((acc, p) => acc + p.amount, 0);
  const hotelOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const p of payments) if (!m.has(groupKey(p.hotelName))) m.set(groupKey(p.hotelName), p.hotelName);
    return Array.from(m.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [payments]);
  const typeOptions = useMemo(() => uniq(payments.map((p) => p.eventType ?? NOT_SPECIFIED)), [payments]);

  const allShownSelected = shown.length > 0 && shown.every((p) => selected.has(p.id));
  const toggleAll = () => setSelected(allShownSelected ? new Set() : new Set(shown.map((p) => p.id)));
  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const handleSave = async (input: HotelPaymentInput) => {
    if (editing === "new") {
      await addHotelPayment(clientId, input);
      toast({ title: "Payment added", description: `${input.hotelName} · KES ${money(input.amount)}` });
    } else if (editing) {
      await updateHotelPayment(editing.id, input);
      toast({ title: "Payment saved", description: input.hotelName });
    }
    setEditing(null);
    onChanged();
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deleteHotelPayments(Array.from(selected));
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

  const formInitial: HotelPaymentInput = editing && editing !== "new" ? editing : EMPTY_INPUT;
  const selectedTotal = payments.filter((p) => selected.has(p.id)).reduce((acc, p) => acc + p.amount, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8 w-64" placeholder="Search hotel, event, description..." value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <Select value={eventType} onValueChange={setEventType}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All event types</SelectItem>
            {typeOptions.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={hotel} onValueChange={setHotel}>
          <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All hotels</SelectItem>
            {hotelOptions.map(([k, name]) => <SelectItem key={k} value={k}>{name}</SelectItem>)}
          </SelectContent>
        </Select>
        <div className="ml-auto flex flex-wrap gap-2">
          {canDelete && selected.size > 0 && (
            <Button variant="destructive" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              Delete {selected.size}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => exportPayments(shown, clientName)} disabled={shown.length === 0}>
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
        <EmptyState message={payments.length === 0 ? "No hotel payments on file yet." : "No payments match these filters."} />
      ) : (
        <ScrollableTable containerClassName="max-h-[65vh] border rounded-md" stickyHeader aria-label="Hotel payments">
          <TableHeader>
            <TableRow>
              {canDelete && (
                <TableHead className="w-8">
                  <Checkbox checked={allShownSelected} onCheckedChange={toggleAll} aria-label="Select all shown" />
                </TableHead>
              )}
              <TableHead>Paid On</TableHead>
              <TableHead>Hotel</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Event</TableHead>
              <TableHead>Event Type</TableHead>
              <TableHead>Stay / Event Dates</TableHead>
              <TableHead>Description</TableHead>
              <TableHead>Method</TableHead>
              <TableHead className="text-right">Amount (KES)</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {shown.map((p) => (
              <TableRow key={p.id} data-state={selected.has(p.id) ? "selected" : undefined}>
                {canDelete && (
                  <TableCell>
                    <Checkbox checked={selected.has(p.id)} onCheckedChange={() => toggle(p.id)} aria-label={`Select ${p.hotelName}`} />
                  </TableCell>
                )}
                <TableCell className="whitespace-nowrap">{formatDate(p.paymentDate)}</TableCell>
                <TableCell className="font-medium">
                  {p.hotelName}
                  {p.warnings.length > 0 && (
                    <span title={p.warnings.join("\n")}>
                      <AlertTriangle className="ml-1 inline h-3.5 w-3.5 text-amber-500" />
                    </span>
                  )}
                </TableCell>
                <TableCell>{p.location ?? "-"}</TableCell>
                <TableCell>{p.eventName ?? <span className="text-muted-foreground">{NOT_SPECIFIED}</span>}</TableCell>
                <TableCell>{p.eventType ?? <span className="text-muted-foreground">{NOT_SPECIFIED}</span>}</TableCell>
                <TableCell className="whitespace-nowrap">{stayText(p) || "-"}</TableCell>
                <TableCell className="max-w-xs text-sm text-muted-foreground">{p.description ?? ""}</TableCell>
                <TableCell className="whitespace-nowrap">{p.paymentMethod ?? "-"}</TableCell>
                <TableCell className="text-right tabular-nums">{money(p.amount)}</TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(p)} aria-label={`Edit ${p.hotelName} payment`}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={canDelete ? 9 : 8}>
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
          open
          title={editing === "new" ? "Add hotel payment" : "Edit hotel payment"}
          initial={formInitial}
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
