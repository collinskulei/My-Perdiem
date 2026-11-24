/**
 * @file Per diem "Bank Balance" tab: a per-client running balance for
 * counter-checking money paid out against bank deposits. Top-ups (bank
 * deposits) add to it; per diem paid on or after the client's FIRST
 * top-up date is deducted (see 0040_perdiem_bank_balance.sql). Pending
 * imported payments are shown as "balance after pending" but not deducted.
 *
 * Super/Master Admins pick a client and can add, edit and delete top-ups
 * (RLS enforces the same); an Organization Admin sees their own client's
 * balance read-only.
 */
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { AlertTriangle, Download, Landmark, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollableTable } from "@/components/ui/scrollable-table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { AccessTier, Client } from "@/lib/data";
import {
  addBankTopup, deleteBankTopup, getBankBalances, getBankTopups, updateBankTopup,
  type BankBalance, type BankTopup, type BankTopupInput,
} from "@/lib/supabase/bank";
import { formatDate, parseAmount } from "@/lib/hotels/parse";
import { money } from "./hotels/hotels-shared";
import { EmptyState } from "./insights/shared";

const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

type StatementRow =
  | { kind: "topup"; key: string; date: string; amount: number; balance: number; topup: BankTopup }
  | { kind: "paid"; key: string; date: string; amount: number; count: number; balance: number };

/** Top-ups and each day's per diem payments, oldest first, with a running
 * balance. On the same date the top-up comes first (money in before out). */
function buildStatement(topups: BankTopup[], daily: BankBalance["daily"]): StatementRow[] {
  const items = [
    ...topups.map((t) => ({ kind: "topup" as const, date: t.depositDate, order: 0, t })),
    ...daily.map((d) => ({ kind: "paid" as const, date: d.date, order: 1, d })),
  ].sort((a, b) => a.date.localeCompare(b.date) || a.order - b.order);
  let balance = 0;
  return items.map((it) => {
    if (it.kind === "topup") {
      balance += it.t.amount;
      return { kind: "topup", key: `t-${it.t.id}`, date: it.date, amount: it.t.amount, balance, topup: it.t };
    }
    balance -= it.d.amount;
    return { kind: "paid", key: `p-${it.date}`, date: it.date, amount: it.d.amount, count: it.d.count, balance };
  });
}

function exportStatement(rows: StatementRow[], clientName: string) {
  const header = ["Date", "Type", "Details", "Top-up (KES)", "Per Diem Paid (KES)", "Balance (KES)"];
  const body = rows.map((r) => r.kind === "topup"
    ? [formatDate(r.date), "Top-up", [r.topup.reference, r.topup.notes].filter(Boolean).join(" - "), r.amount, "", r.balance]
    : [formatDate(r.date), "Per diem paid", `${r.count} payment${r.count === 1 ? "" : "s"}`, "", r.amount, r.balance]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[`${clientName} - Per diem bank balance`], header, ...body]), "Bank balance");
  XLSX.writeFile(wb, `${(clientName || "client").replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "-")}_bank-balance.xlsx`);
}

function TopupDialog({ initial, title, onClose, onSave }: {
  initial: BankTopupInput;
  title: string;
  onClose: () => void;
  onSave: (input: BankTopupInput) => Promise<void>;
}) {
  const [form, setForm] = useState(initial);
  const [amountText, setAmountText] = useState(initial.amount ? String(initial.amount) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    const amount = parseAmount(amountText);
    if (!form.depositDate) return setError("Enter the deposit date.");
    if (amount === null || amount <= 0) return setError("Enter an amount above zero.");
    setError(null);
    setSaving(true);
    try {
      await onSave({ ...form, amount });
    } catch (e: any) {
      setError(e?.message ?? "Couldn't save the top-up.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !saving && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            A bank deposit for per diem payments. The first top-up is the opening balance: per diem paid on or after its date is deducted.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="bt-date">Deposit Date *</Label>
            <Input id="bt-date" type="date" value={form.depositDate} onChange={(e) => setForm((f) => ({ ...f, depositDate: e.target.value }))} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="bt-amount">Amount (KES) *</Label>
            <Input id="bt-amount" inputMode="decimal" value={amountText} onChange={(e) => setAmountText(e.target.value)} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="bt-ref">Bank Reference</Label>
            <Input id="bt-ref" value={form.reference ?? ""} onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value || null }))} />
          </div>
          <div className="space-y-1 sm:col-span-2">
            <Label htmlFor="bt-notes">Notes</Label>
            <Textarea id="bt-notes" rows={2} value={form.notes ?? ""} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value || null }))} />
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

function Stat({ label, value, sub, negative }: { label: string; value: number; sub?: string; negative?: boolean }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("text-2xl font-bold tabular-nums", negative && "text-destructive")}>KES {money(value)}</p>
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function AdminBankBalanceTab({ clients, currentAdmin, isMultiClientAdmin, fixedClientId }: {
  clients: Client[];
  currentAdmin: { accessTier: AccessTier; clientId: string | null } | null;
  isMultiClientAdmin: boolean;
  /** Client portal (including a Super Admin viewing one): that client only. */
  fixedClientId: string | null;
}) {
  const { toast } = useToast();
  const lockedClientId = fixedClientId ?? (isMultiClientAdmin ? null : currentAdmin?.clientId ?? null);
  const [clientId, setClientId] = useState<string | null>(lockedClientId);
  const canEdit = isMultiClientAdmin;

  const [topups, setTopups] = useState<BankTopup[] | null>(null);
  const [balance, setBalance] = useState<BankBalance | null>(null);
  const [missing, setMissing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<BankTopup | "new" | null>(null);
  const [toDelete, setToDelete] = useState<BankTopup | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Super/Master without a fixed client: default to the first client that
  // already has a top-up, else the first client alphabetically.
  useEffect(() => {
    if (lockedClientId || clientId || clients.length === 0) return;
    let cancelled = false;
    getBankBalances(null).then((all) => {
      if (cancelled) return;
      const withTopup = all?.[0]?.clientId;
      const first = [...clients].sort((a, b) => a.name.localeCompare(b.name))[0]?.id ?? null;
      setClientId(withTopup && clients.some((c) => c.id === withTopup) ? withTopup : first);
    });
    return () => { cancelled = true; };
  }, [lockedClientId, clientId, clients]);

  const load = useCallback(async () => {
    if (!clientId) return;
    setLoading(true);
    const [t, b] = await Promise.all([getBankTopups(clientId), getBankBalances(clientId)]);
    setMissing(t === null || b === null);
    setTopups(t ?? []);
    setBalance(b?.[0] ?? null);
    setLoading(false);
  }, [clientId]);

  useEffect(() => { load(); }, [load]);

  const clientName = clients.find((c) => c.id === clientId)?.name ?? "";
  const statement = useMemo(() => buildStatement(topups ?? [], balance?.daily ?? []), [topups, balance]);
  const firstNegative = statement.find((r) => r.balance < -0.005);

  const handleSave = async (input: BankTopupInput) => {
    if (!clientId) return;
    if (editing === "new") {
      await addBankTopup(clientId, input);
      toast({ title: "Top-up added", description: `KES ${money(input.amount)} on ${formatDate(input.depositDate)}` });
    } else if (editing) {
      await updateBankTopup(editing.id, input);
      toast({ title: "Top-up saved" });
    }
    setEditing(null);
    load();
  };

  const handleDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await deleteBankTopup(toDelete.id);
      toast({ title: "Top-up deleted" });
      setToDelete(null);
      load();
    } catch (e: any) {
      toast({ title: "Delete failed", description: e?.message ?? "Couldn't delete the top-up.", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  };

  const sortedClients = useMemo(() => [...clients].sort((a, b) => a.name.localeCompare(b.name)), [clients]);
  const afterPending = (balance?.balance ?? 0) - (balance?.pendingAmount ?? 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        {!lockedClientId && (
          <div className="space-y-1">
            <Label>Client</Label>
            <Select value={clientId ?? undefined} onValueChange={(v) => setClientId(v)}>
              <SelectTrigger className="w-64"><SelectValue placeholder="Choose a client" /></SelectTrigger>
              <SelectContent>
                {sortedClients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => exportStatement(statement, clientName)} disabled={statement.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Excel
          </Button>
          {canEdit && (
            <Button size="sm" onClick={() => setEditing("new")} disabled={!clientId || missing}>
              <Plus className="mr-2 h-4 w-4" />
              Top-up
            </Button>
          )}
        </div>
      </div>

      {missing ? (
        <EmptyState message="Bank Balance isn't set up yet - migration 0040_perdiem_bank_balance.sql needs to be applied in Supabase." />
      ) : loading || topups === null ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
        </div>
      ) : !balance ? (
        <EmptyState message={canEdit
          ? "No top-ups yet. Add the first top-up (the opening balance) to start tracking - per diem paid from its date onward will be deducted."
          : "No bank top-ups have been recorded for this client yet."} />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Stat label="Bank Balance" value={balance.balance} negative={balance.balance < 0}
              sub={`since ${formatDate(balance.startDate)}`} />
            <Stat label="Total Top-ups" value={balance.topupsTotal}
              sub={`${balance.topupCount} deposit${balance.topupCount === 1 ? "" : "s"} · last ${formatDate(balance.lastTopupDate)}`} />
            <Stat label="Per Diem Paid" value={balance.paidTotal}
              sub={`${balance.paidCount.toLocaleString()} payment${balance.paidCount === 1 ? "" : "s"} since ${formatDate(balance.startDate)}`} />
            <Stat label="Balance After Pending" value={afterPending} negative={afterPending < 0}
              sub={`${balance.pendingCount.toLocaleString()} pending · KES ${money(balance.pendingAmount)} not yet deducted`} />
          </div>

          {firstNegative && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Balance went below zero</AlertTitle>
              <AlertDescription>
                From {formatDate(firstNegative.date)} more per diem is recorded as paid than was deposited. Check for a missing top-up or a payment recorded by mistake.
              </AlertDescription>
            </Alert>
          )}

          <ScrollableTable containerClassName="max-h-[65vh] border rounded-md" stickyHeader aria-label="Bank balance statement">
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Details</TableHead>
                <TableHead className="text-right">Top-up (KES)</TableHead>
                <TableHead className="text-right">Per Diem Paid (KES)</TableHead>
                <TableHead className="text-right">Balance (KES)</TableHead>
                {canEdit && <TableHead className="w-20" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...statement].reverse().map((r) => (
                <TableRow key={r.key}>
                  <TableCell className="whitespace-nowrap">{formatDate(r.date)}</TableCell>
                  <TableCell>
                    {r.kind === "topup" ? (
                      <span className="flex items-center gap-2 font-medium">
                        <Landmark className="h-4 w-4 text-primary shrink-0" />
                        Top-up{r.topup.reference ? ` · ${r.topup.reference}` : ""}
                      </span>
                    ) : (
                      <span>Per diem paid · {r.count.toLocaleString()} payment{r.count === 1 ? "" : "s"}</span>
                    )}
                    {r.kind === "topup" && r.topup.notes && <span className="block text-xs text-muted-foreground">{r.topup.notes}</span>}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{r.kind === "topup" ? money(r.amount) : ""}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.kind === "paid" ? money(r.amount) : ""}</TableCell>
                  <TableCell className={cn("text-right tabular-nums font-medium", r.balance < -0.005 && "text-destructive")}>{money(r.balance)}</TableCell>
                  {canEdit && (
                    <TableCell>
                      {r.kind === "topup" && (
                        <div className="flex">
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(r.topup)} aria-label="Edit top-up">
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setToDelete(r.topup)} aria-label="Delete top-up">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </ScrollableTable>
        </>
      )}

      {editing !== null && (
        <TopupDialog
          key={editing === "new" ? "new" : editing.id}
          title={editing === "new" ? `Top-up${clientName ? ` · ${clientName}` : ""}` : "Edit top-up"}
          initial={editing === "new" ? { amount: 0, depositDate: todayYmd(), reference: null, notes: null } : editing}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}

      <AlertDialog open={toDelete !== null} onOpenChange={(o) => !o && !deleting && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this top-up?</AlertDialogTitle>
            <AlertDialogDescription>
              KES {toDelete ? money(toDelete.amount) : ""} on {toDelete ? formatDate(toDelete.depositDate) : ""} will be removed and the balance recalculated. This can&apos;t be undone.
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
