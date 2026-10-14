/**
 * @file Helpers shared by the Travel & Ground Transfers tabs: rollups by
 * type / supplier / month and Excel export. Money formatting and grouping
 * keys are the Hotel Bookings module's (hotels-shared.ts).
 */
import * as XLSX from "xlsx";
import type { TravelPayment } from "@/lib/supabase/travel";
import { formatDate } from "@/lib/hotels/parse";
import { NOT_SPECIFIED, groupKey } from "../hotels/hotels-shared";

export function totalsBy(payments: TravelPayment[], pick: (p: TravelPayment) => string | null): { name: string; total: number; payments: number }[] {
  const map = new Map<string, { name: string; total: number; payments: number }>();
  for (const p of payments) {
    const name = pick(p) ?? NOT_SPECIFIED;
    const key = groupKey(name);
    const r = map.get(key) ?? { name, total: 0, payments: 0 };
    r.total += p.amount;
    r.payments += 1;
    map.set(key, r);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

/** Oldest month first, empty months filled in, one amount per type. */
export function totalsByMonthAndType(payments: TravelPayment[], types: string[]): Record<string, string | number>[] {
  if (payments.length === 0) return [];
  const map = new Map<string, Record<string, number>>();
  for (const p of payments) {
    const m = p.paymentDate.slice(0, 7);
    const r = map.get(m) ?? {};
    const t = p.paymentType ?? NOT_SPECIFIED;
    r[t] = (r[t] ?? 0) + p.amount;
    map.set(m, r);
  }
  const months = Array.from(map.keys()).sort();
  const out: Record<string, string | number>[] = [];
  let [y, mo] = months[0].split("-").map(Number);
  const [ly, lm] = months[months.length - 1].split("-").map(Number);
  while (y < ly || (y === ly && mo <= lm)) {
    const key = `${y}-${String(mo).padStart(2, "0")}`;
    const amounts = map.get(key) ?? {};
    out.push({
      month: key,
      label: new Date(y, mo - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
      ...Object.fromEntries(types.map((t) => [t, amounts[t] ?? 0])),
    });
    mo += 1;
    if (mo > 12) { mo = 1; y += 1; }
  }
  return out;
}

function sanitize(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "-");
}

export function exportTravelPayments(payments: TravelPayment[], clientName: string) {
  const extraKeys = Array.from(new Set(payments.flatMap((p) => Object.keys(p.extra))));
  const header = [
    "Description", "Type", "Route / Venue", "Supplier", "Event", "Travel Date",
    "Payment Date", "Payment Method", "Reference", "Amount (KES)", "Notes", ...extraKeys,
  ];
  const rows = payments.map((p) => [
    p.description, p.paymentType ?? "", p.route ?? "", p.supplier ?? "", p.eventName ?? "", formatDate(p.travelDate),
    formatDate(p.paymentDate), p.paymentMethod ?? "", p.reference ?? "", p.amount, p.notes ?? "",
    ...extraKeys.map((k) => p.extra[k] ?? ""),
  ]);
  const total = header.map((_, i) => (i === 8 ? "TOTAL" : i === 9 ? payments.reduce((acc, p) => acc + p.amount, 0) : ""));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[`${clientName} - Travel & ground transfer payments`], header, ...rows, total]), "Travel payments");
  XLSX.writeFile(wb, `${sanitize(clientName || "client")}_travel-payments.xlsx`);
}
