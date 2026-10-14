/**
 * @file The Travel & Ground Transfers module's fields - typed columns on
 * travel_payments (0038_travel_payments.sql - keep in sync). An uploaded
 * file's columns are mapped onto these; anything else is kept under its
 * own header in `extra`, or ignored.
 */
import { normalizeHeader } from "../hotels/fields";

export type TravelField =
  | "description"
  | "payment_type"
  | "route"
  | "supplier"
  | "event_name"
  | "travel_date"
  | "payment_date"
  | "payment_method"
  | "reference"
  | "amount"
  | "notes";

/** How one file column is stored: a field, kept as an extra, or ignored. */
export type TravelColumnChoice = { kind: "field"; field: TravelField } | { kind: "extra" } | { kind: "ignore" };

export const TRAVEL_FIELDS: { key: TravelField; label: string; required?: boolean }[] = [
  { key: "description", label: "Description", required: true },
  { key: "payment_date", label: "Payment Date", required: true },
  { key: "amount", label: "Amount", required: true },
  { key: "payment_type", label: "Type" },
  { key: "route", label: "Route / Venue" },
  { key: "supplier", label: "Supplier" },
  { key: "event_name", label: "Event" },
  { key: "travel_date", label: "Travel Date" },
  { key: "payment_method", label: "Payment Method" },
  { key: "reference", label: "Reference / Ticket No" },
  { key: "notes", label: "Notes" },
];

export const TRAVEL_FIELD_LABEL: Record<TravelField, string> = Object.fromEntries(
  TRAVEL_FIELDS.map((f) => [f.key, f.label])
) as Record<TravelField, string>;

export const REQUIRED_TRAVEL_FIELDS: TravelField[] = TRAVEL_FIELDS.filter((f) => f.required).map((f) => f.key);

/** The usual values of Type; free text is allowed too. */
export const TRAVEL_TYPES = ["Flight", "Flight Rescheduling", "Ground Transfer"] as const;

/** First matching pattern wins. Tested against normalizeHeader() output. */
const HEADER_GUESSES: [TravelField, RegExp][] = [
  ["payment_type", /^(payment |booking |travel )?type$|^category$|^mode of (travel|transport)$/],
  ["description", /^(name of the )?(event|activity)( ?\/ ?activity)?$|^name of the event|^(description|details|particulars|narration|purpose|item)$/],
  ["route", /^(route|venue|destination|from.?to|sector|location|journey)$/],
  ["supplier", /^(supplier|vendor|airline|carrier|transporter|agent|travel agent|payee)( name)?$/],
  ["event_name", /^(event|training|workshop|programme|program)( name| title)?$/],
  ["travel_date", /^(travel|flight|departure|trip|journey)( date)?$|^date of travel$/],
  ["payment_date", /^(payment|paid|transaction|value|processed)( date)?$|date (paid|processed)|^date$/],
  ["payment_method", /^(payment )?(method|mode)|^paid via/],
  ["reference", /^(ref|reference|invoice|lpo|voucher|receipt|ticket|pnr)( no\.?| number| #)?$/],
  ["amount", /^(amount|total|cost|amount paid|amount \(kes\)|kes)$|^amount/],
  ["notes", /^(notes?|remarks?|comments?)$/],
];

export function guessTravelField(header: unknown): TravelField | undefined {
  const n = normalizeHeader(header);
  if (!n) return undefined;
  return HEADER_GUESSES.find(([, re]) => re.test(n))?.[0];
}

/** First-guess mapping for a file's header row: each field goes to the
 * first column that looks like it; other named columns are kept as
 * extras, blank-headed ones ignored. The uploader confirms before import. */
export function guessTravelColumns(headers: unknown[]): TravelColumnChoice[] {
  const used = new Set<TravelField>();
  return headers.map((h): TravelColumnChoice => {
    if (!normalizeHeader(h)) return { kind: "ignore" };
    const field = guessTravelField(h);
    if (field && !used.has(field)) {
      used.add(field);
      return { kind: "field", field };
    }
    return { kind: "extra" };
  });
}
