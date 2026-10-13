/**
 * @file Helpers shared by the Hotel Bookings tabs: rollups of payments by
 * hotel / event / month, and Excel export (SheetJS, same library the
 * upload reads with). The generic table export and file reader are the
 * Salary module's (salary-shared.ts).
 */
import * as XLSX from "xlsx";
import type { HotelPayment } from "@/lib/supabase/hotels";
import { formatDate } from "@/lib/hotels/parse";

export const money = (n: number) => n.toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export const shortCurrency = (v: number) =>
  Math.abs(v) >= 1_000_000 ? `KES ${(v / 1_000_000).toFixed(1)}M` : Math.abs(v) >= 1_000 ? `KES ${(v / 1_000).toFixed(0)}K` : `KES ${v}`;

/** Case/space-insensitive grouping key, so "Sirikwa Hotel" and
 * "sirikwa  hotel" are one hotel. */
export const groupKey = (s: string) => s.replace(/\s+/g, " ").trim().toLowerCase();

export const NOT_SPECIFIED = "Not specified";

export type HotelRollup = {
  key: string;
  hotelName: string;
  locations: string[];
  payments: number;
  total: number;
  events: string[];
  firstPayment: string;
  lastPayment: string;
};

export function rollupByHotel(payments: HotelPayment[]): HotelRollup[] {
  const map = new Map<string, HotelRollup>();
  for (const p of payments) {
    const key = groupKey(p.hotelName);
    const r = map.get(key) ?? {
      key, hotelName: p.hotelName, locations: [], payments: 0, total: 0, events: [],
      firstPayment: p.paymentDate, lastPayment: p.paymentDate,
    };
    r.payments += 1;
    r.total += p.amount;
    if (p.location && !r.locations.includes(p.location)) r.locations.push(p.location);
    if (p.eventName && !r.events.includes(p.eventName)) r.events.push(p.eventName);
    if (p.paymentDate < r.firstPayment) r.firstPayment = p.paymentDate;
    if (p.paymentDate > r.lastPayment) r.lastPayment = p.paymentDate;
    map.set(key, r);
  }
  return Array.from(map.values()).sort((a, b) => b.total - a.total);
}

export type EventRollup = { key: string; eventName: string; eventType: string; hotels: number; payments: number; total: number };

export function rollupByEvent(payments: HotelPayment[]): EventRollup[] {
  const map = new Map<string, EventRollup & { hotelKeys: Set<string> }>();
  for (const p of payments) {
    const name = p.eventName ?? NOT_SPECIFIED;
    const key = groupKey(name);
    const r = map.get(key) ?? { key, eventName: name, eventType: p.eventType ?? NOT_SPECIFIED, hotels: 0, payments: 0, total: 0, hotelKeys: new Set<string>() };
    r.payments += 1;
    r.total += p.amount;
    r.hotelKeys.add(groupKey(p.hotelName));
    r.hotels = r.hotelKeys.size;
    map.set(key, r);
  }
  return Array.from(map.values())
    .map(({ hotelKeys: _, ...r }) => r)
    .sort((a, b) => b.total - a.total);
}

export function totalsBy(payments: HotelPayment[], pick: (p: HotelPayment) => string | null): { name: string; total: number; payments: number }[] {
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

/** Oldest month first, with empty months in between filled in. */
export function totalsByMonth(payments: HotelPayment[]): { month: string; label: string; total: number; payments: number }[] {
  if (payments.length === 0) return [];
  const map = new Map<string, { total: number; payments: number }>();
  for (const p of payments) {
    const m = p.paymentDate.slice(0, 7);
    const r = map.get(m) ?? { total: 0, payments: 0 };
    r.total += p.amount;
    r.payments += 1;
    map.set(m, r);
  }
  const months = Array.from(map.keys()).sort();
  const out: { month: string; label: string; total: number; payments: number }[] = [];
  let [y, mo] = months[0].split("-").map(Number);
  const [ly, lm] = months[months.length - 1].split("-").map(Number);
  while (y < ly || (y === ly && mo <= lm)) {
    const key = `${y}-${String(mo).padStart(2, "0")}`;
    out.push({
      month: key,
      label: new Date(y, mo - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" }),
      ...(map.get(key) ?? { total: 0, payments: 0 }),
    });
    mo += 1;
    if (mo > 12) { mo = 1; y += 1; }
  }
  return out;
}

function sanitize(name: string): string {
  return name.replace(/[\\/:*?"<>|]+/g, "").replace(/\s+/g, "-");
}

export function exportPayments(payments: HotelPayment[], clientName: string) {
  const extraKeys = Array.from(new Set(payments.flatMap((p) => Object.keys(p.extra))));
  const header = [
    "Event", "Event Type", "Hotel", "Location", "Description", "Stay Start", "Stay End",
    "Payment Date", "Payment Method", "Reference", "Amount (KES)", "Notes", ...extraKeys,
  ];
  const rows = payments.map((p) => [
    p.eventName ?? "", p.eventType ?? "", p.hotelName, p.location ?? "", p.description ?? "",
    formatDate(p.stayStart), formatDate(p.stayEnd), formatDate(p.paymentDate),
    p.paymentMethod ?? "", p.reference ?? "", p.amount, p.notes ?? "",
    ...extraKeys.map((k) => p.extra[k] ?? ""),
  ]);
  const total = header.map((_, i) => (i === 9 ? "TOTAL" : i === 10 ? payments.reduce((acc, p) => acc + p.amount, 0) : ""));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([[`${clientName} - Hotel payments`], header, ...rows, total]), "Hotel payments");
  XLSX.writeFile(wb, `${sanitize(clientName || "client")}_hotel-payments.xlsx`);
}
