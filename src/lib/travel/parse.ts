/**
 * @file Reads a travel payments spreadsheet (e.g. Apeiro's "Flights
 * Booking and Ground Transfer") into rows for import_travel_payments
 * (0038_travel_payments.sql). Same forgiving rules as the hotel reader
 * (hotels/parse.ts, whose text/date/place helpers it uses), plus what
 * this kind of list leaves in the description:
 * - Type: "reschedul..." = Flight Rescheduling; flight / ticket / air =
 *   Flight; anything else = Ground Transfer (transport is the only other
 *   kind of payment these lists hold);
 * - Travel date: the first day-first date written in the description;
 * - Supplier and event, for ground transfers: "Kabon Transporters
 *   (30/03/2025) Uasin Gishu Workshop" -> supplier "Kabon Transporters",
 *   event "Uasin Gishu Workshop".
 * A totals row - one saying TOTAL, or a last row with only an amount -
 * ends the list and is kept as the file's stated total. A flight whose
 * reverse route (Eldoret -> Nairobi after Nairobi -> Eldoret) is more than
 * a month away from it is flagged, since one of the two dates is likely
 * mistyped. Nothing is guessed beyond that; values read from the
 * description are marked as such in the preview.
 */
import { guessTravelField, REQUIRED_TRAVEL_FIELDS, type TravelColumnChoice, type TravelField } from "./fields";
import { cleanText, datesInText, formatDate, parseAmount, parseDate, placeInText } from "../hotels/parse";

export type ParsedTravelPayment = {
  /** 1-based row number in the spreadsheet, for messages. */
  rowNumber: number;
  description: string | null;
  paymentType: string | null;
  route: string | null;
  supplier: string | null;
  eventName: string | null;
  /** 'YYYY-MM-DD' */
  travelDate: string | null;
  /** 'YYYY-MM-DD' */
  paymentDate: string | null;
  paymentMethod: string | null;
  reference: string | null;
  amount: number | null;
  notes: string | null;
  extra: Record<string, string | number>;
  /** Stored with the payment. */
  warnings: string[];
  /** Row can't be stored until fixed in the file. */
  errors: string[];
  /** Fields filled in from the description rather than their own column. */
  inferred: { type?: boolean; supplier?: boolean; event?: boolean; travelDate?: boolean };
};

export type TravelSheet = {
  headerIndex: number;
  headers: unknown[];
  bodyRows: unknown[][];
};

export type BuiltTravelFile = {
  payments: ParsedTravelPayment[];
  /** The file's own total row amount, if it has one. */
  statedTotal: number | null;
  /** Sum of rows with a readable amount. */
  computedTotal: number;
};

// --- Reading the description ---

export function typeFromText(...texts: (string | null)[]): string {
  const t = texts.filter(Boolean).join(" ");
  if (/reschedul/i.test(t)) return "Flight Rescheduling";
  if (/\b(flights?|tickets?|air ?(fare|line|ticket)s?)\b/i.test(t)) return "Flight";
  return "Ground Transfer";
}

/** Known places in the text, in the order written. */
export function placesInText(text: string | null): string[] {
  const out: string[] = [];
  let rest = text ?? "";
  for (let guard = 0; guard < 10; guard++) {
    const p = placeInText(rest);
    if (!p) break;
    const at = rest.toLowerCase().replace(/'/g, "").indexOf(p.toLowerCase().replace(/'/g, ""));
    if (at < 0) break;
    out.push(p);
    rest = rest.slice(at + p.length);
  }
  return out;
}

const DATE_IN_BRACKETS = /\(\s*\d{1,2}[\/.\-]\d{1,2}[\/.\-]\d{2,4}\s*\)/;

/** "Come 2 Kenya (21/03/2025) Kirinyaga Workshop" -> supplier and event.
 * Supplier = the text before the bracketed date, or before the first
 * known place; event = the text after the date, or from that place on. */
export function supplierAndEvent(description: string): { supplier: string | null; event: string | null } {
  const tidy = (s: string) => s.replace(/^[\s\-–,:]+|[\s\-–,:]+$/g, "").trim() || null;
  const bracket = description.match(DATE_IN_BRACKETS);
  if (bracket && bracket.index !== undefined) {
    return {
      supplier: tidy(description.slice(0, bracket.index)),
      event: tidy(description.slice(bracket.index + bracket[0].length)),
    };
  }
  const place = placeInText(description);
  if (place) {
    const at = description.toLowerCase().indexOf(place.toLowerCase());
    if (at > 0) return { supplier: tidy(description.slice(0, at)), event: tidy(description.slice(at)) };
  }
  return { supplier: null, event: null };
}

// --- Sheet ---

/** Finds the header row (the first of the top 20 rows naming at least two
 * of Description / Payment Date / Amount, or three fields of any kind). */
export function readTravelSheet(rows: unknown[][]): TravelSheet | null {
  const limit = Math.min(rows.length, 20);
  for (let i = 0; i < limit; i++) {
    const fields = (rows[i] ?? []).map(guessTravelField).filter(Boolean) as TravelField[];
    const required = fields.filter((f) => REQUIRED_TRAVEL_FIELDS.includes(f)).length;
    if (required >= 2 || new Set(fields).size >= 3) {
      return { headerIndex: i, headers: rows[i] ?? [], bodyRows: rows.slice(i + 1) };
    }
  }
  return null;
}

const TOTAL_RE = /^(grand )?totals?\b/i;
const RETURN_LEG_GAP_DAYS = 31;

const dayNumber = (ymd: string) => Date.UTC(Number(ymd.slice(0, 4)), Number(ymd.slice(5, 7)) - 1, Number(ymd.slice(8, 10))) / 86400000;

/** Applies a column mapping to the sheet's rows. */
export function buildTravelPayments(sheet: TravelSheet, columns: TravelColumnChoice[]): BuiltTravelFile {
  const colOf = (f: TravelField) => columns.findIndex((c) => c.kind === "field" && c.field === f);
  const idx = Object.fromEntries(
    (["description", "payment_type", "route", "supplier", "event_name", "travel_date", "payment_date",
      "payment_method", "reference", "amount", "notes"] as TravelField[]).map((f) => [f, colOf(f)])
  ) as Record<TravelField, number>;
  const at = (row: unknown[], f: TravelField) => (idx[f] >= 0 ? row[idx[f]] : null);

  const payments: ParsedTravelPayment[] = [];
  let statedTotal: number | null = null;

  for (let r = 0; r < sheet.bodyRows.length; r++) {
    const row = sheet.bodyRows[r] ?? [];
    const filled = row.filter((c) => cleanText(c) !== null || typeof c === "number" || c instanceof Date);
    if (filled.length === 0) continue;

    const description = cleanText(at(row, "description"));
    const rawAmount = at(row, "amount");
    const amount = parseAmount(rawAmount);
    const rawPaid = at(row, "payment_date");
    const paymentDate = parseDate(rawPaid);

    // The file's own totals row ends the list: one saying TOTAL, or one
    // with an amount and nothing else that identifies a payment.
    const saysTotal = !description && row.some((c) => typeof c === "string" && TOTAL_RE.test(c.trim()));
    const amountOnly = !description && !paymentDate && amount !== null;
    if (saysTotal || amountOnly) {
      statedTotal = amount;
      break;
    }

    const errors: string[] = [];
    const warnings: string[] = [];
    if (!description) errors.push("No description");
    if (!paymentDate) errors.push(cleanText(rawPaid) || rawPaid instanceof Date ? `Payment date "${String(rawPaid)}" isn't a date` : "No payment date");
    if (amount === null) errors.push(cleanText(rawAmount) ? `Amount "${String(rawAmount)}" isn't a number` : "No amount");
    else if (amount <= 0) errors.push("Amount must be above zero");

    const inferred: ParsedTravelPayment["inferred"] = {};
    const route = cleanText(at(row, "route"));

    let paymentType = cleanText(at(row, "payment_type"));
    if (!paymentType && description) {
      paymentType = typeFromText(description, route);
      inferred.type = true;
    }

    let travelDate = parseDate(at(row, "travel_date"));
    if (!travelDate) {
      travelDate = datesInText(description)[0] ?? null;
      if (travelDate) inferred.travelDate = true;
    }

    let supplier = cleanText(at(row, "supplier"));
    let eventName = cleanText(at(row, "event_name"));
    if (description && paymentType === "Ground Transfer" && (!supplier || !eventName)) {
      const found = supplierAndEvent(description);
      if (!supplier && found.supplier) {
        supplier = found.supplier;
        inferred.supplier = true;
      }
      if (!eventName && found.event) {
        eventName = found.event;
        inferred.event = true;
      }
    }

    const extra: Record<string, string | number> = {};
    columns.forEach((c, i) => {
      if (c.kind !== "extra") return;
      const header = String(sheet.headers[i] ?? "").trim() || `Column ${i + 1}`;
      const v = row[i];
      if (typeof v === "number") extra[header] = v;
      else if (v instanceof Date) extra[header] = parseDate(v) ?? String(v);
      else {
        const t = cleanText(v);
        if (t) extra[header] = t;
      }
    });

    payments.push({
      rowNumber: sheet.headerIndex + 2 + r,
      description,
      paymentType,
      route,
      supplier,
      eventName,
      travelDate,
      paymentDate,
      paymentMethod: cleanText(at(row, "payment_method")),
      reference: cleanText(at(row, "reference")),
      amount,
      notes: cleanText(at(row, "notes")),
      extra,
      warnings,
      errors,
      inferred,
    });
  }

  flagReturnLegs(payments);

  const computedTotal = Math.round(payments.reduce((acc, p) => acc + (p.amount ?? 0), 0) * 100) / 100;
  return { payments, statedTotal, computedTotal };
}

/** Flights between two places whose nearest reverse trip (Eldoret ->
 * Nairobi after Nairobi -> Eldoret) is more than a month away. Multi-city
 * rows (e.g. a month's bookings in one line) aren't legs and are skipped. */
function flagReturnLegs(payments: ParsedTravelPayment[]) {
  const legs = payments
    .filter((p) => p.paymentType === "Flight")
    .map((p) => {
      const fromDesc = placesInText(p.description);
      const places = fromDesc.length >= 2 ? fromDesc : placesInText(p.route);
      return { p, places, date: p.travelDate ?? p.paymentDate };
    })
    .filter((l) => l.places.length === 2 && l.places[0] !== l.places[1] && l.date);
  for (const a of legs) {
    let nearest: { leg: (typeof legs)[number]; gap: number } | null = null;
    for (const b of legs) {
      if (a === b || a.places[0] !== b.places[1] || a.places[1] !== b.places[0]) continue;
      const gap = Math.abs(dayNumber(a.date!) - dayNumber(b.date!));
      if (!nearest || gap < nearest.gap) nearest = { leg: b, gap };
    }
    if (nearest && nearest.gap > RETURN_LEG_GAP_DAYS) {
      const b = nearest.leg;
      a.p.warnings.push(
        `Reverse trip (row ${b.p.rowNumber}, ${b.places[0]} → ${b.places[1]}, ${formatDate(b.date)}) is ${nearest.gap} days apart - check the dates`
      );
    }
  }
}

/** Same key the import RPC uses to spot a payment already on file. */
export function travelPaymentKey(description: string, paymentDate: string, amount: number): string {
  return `${description.replace(/\s+/g, " ").trim().toLowerCase()}|${paymentDate}|${Number(amount).toFixed(2)}`;
}
