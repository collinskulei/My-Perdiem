/**
 * @file The Hotel Bookings module's fields - typed columns on
 * hotel_payments (0036_hotel_payments.sql - keep in sync). An uploaded
 * file's columns are mapped onto these; anything else is kept under its
 * own header in `extra`, or ignored.
 */

export type HotelField =
  | "event_name"
  | "event_type"
  | "hotel_name"
  | "location"
  | "description"
  | "stay_start"
  | "stay_end"
  | "payment_date"
  | "payment_method"
  | "reference"
  | "amount"
  | "notes";

/** How one file column is stored: a field, kept as an extra, or ignored. */
export type HotelColumnChoice = { kind: "field"; field: HotelField } | { kind: "extra" } | { kind: "ignore" };

export const HOTEL_FIELDS: { key: HotelField; label: string; required?: boolean }[] = [
  { key: "hotel_name", label: "Hotel", required: true },
  { key: "payment_date", label: "Payment Date", required: true },
  { key: "amount", label: "Amount", required: true },
  { key: "event_name", label: "Event" },
  { key: "event_type", label: "Event Type" },
  { key: "location", label: "Location" },
  { key: "description", label: "Description" },
  { key: "stay_start", label: "Stay / Event Start" },
  { key: "stay_end", label: "Stay / Event End" },
  { key: "payment_method", label: "Payment Method" },
  { key: "reference", label: "Reference / Invoice No" },
  { key: "notes", label: "Notes" },
];

export const HOTEL_FIELD_LABEL: Record<HotelField, string> = Object.fromEntries(
  HOTEL_FIELDS.map((f) => [f.key, f.label])
) as Record<HotelField, string>;

export const REQUIRED_HOTEL_FIELDS: HotelField[] = HOTEL_FIELDS.filter((f) => f.required).map((f) => f.key);

/** First matching pattern wins. Tested against normalizeHeader() output. */
const HEADER_GUESSES: [HotelField, RegExp][] = [
  ["event_type", /^(event|activity|meeting) ?type|^category|^type$/],
  ["event_name", /^(event|activity|meeting|training|programme|program)( name| title)?$/],
  ["hotel_name", /^(hotel|venue|vendor|supplier|payee|accommodation)( name)?$/],
  ["location", /^(location|town|city|county|place)$/],
  ["stay_start", /^(stay|check.?in|arrival|event|start)( start)? ?date|^check.?in|^date from|^from$/],
  ["stay_end", /^(stay|check.?out|departure|event|end)( end)? ?date|^check.?out|^date to|^to$/],
  ["payment_date", /^(payment|paid|transaction|value)( date)?$|date paid|^date$/],
  ["payment_method", /^(payment )?(method|mode)|^paid via/],
  ["reference", /^(ref|reference|invoice|lpo|voucher|receipt)( no\.?| number| #)?$/],
  ["amount", /^(amount|total|cost|amount paid|amount \(kes\)|kes)$|^amount/],
  ["description", /^(description|details|particulars|narration|purpose)$/],
  ["notes", /^(notes?|remarks?|comments?)$/],
];

/** Lowercased, trimmed, single-spaced, with a trailing colon dropped. */
export function normalizeHeader(h: unknown): string {
  return String(h ?? "").replace(/\s+/g, " ").trim().replace(/:$/, "").toLowerCase();
}

export function guessHotelField(header: unknown): HotelField | undefined {
  const n = normalizeHeader(header);
  if (!n) return undefined;
  return HEADER_GUESSES.find(([, re]) => re.test(n))?.[0];
}

/** First-guess mapping for a file's header row: each field goes to the
 * first column that looks like it; other named columns are kept as
 * extras, blank-headed ones ignored. The uploader confirms before import. */
export function guessColumns(headers: unknown[]): HotelColumnChoice[] {
  const used = new Set<HotelField>();
  return headers.map((h): HotelColumnChoice => {
    if (!normalizeHeader(h)) return { kind: "ignore" };
    const field = guessHotelField(h);
    if (field && !used.has(field)) {
      used.add(field);
      return { kind: "field", field };
    }
    return { kind: "extra" };
  });
}
