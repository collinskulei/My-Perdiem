/**
 * @file Reads a hotel payments spreadsheet (e.g. Apeiro's "Hotels bookings
 * list") into rows for import_hotel_payments (0036_hotel_payments.sql).
 *
 * Real files are loose, so this is forgiving and says what it did:
 * - the header row is found by its column names, not assumed to be row 1;
 * - a TOTAL row ends the list and is kept as the file's stated total;
 * - placeholders ("Not specified", "N/A", "-") are treated as blank;
 * - garbled dashes from a bad encoding ("�", "â€“") are repaired;
 * - with no Location column, the town/county is read from the hotel name,
 *   description or event name (known Kenyan counties and towns only);
 * - with no stay-date columns, dates written in the description
 *   ("stay date 05/02/2025", "held 05/02/2025 – 19/02/2025") are used.
 * Dates are day-first (d/m/yyyy), the Kenyan convention the per diem
 * importer also assumes. Anything that can't be read is left blank -
 * never guessed - and the rows that can't be stored at all (no hotel,
 * payment date or amount) are reported as errors.
 */
import { guessHotelField, REQUIRED_HOTEL_FIELDS, type HotelColumnChoice, type HotelField } from "./fields";

export type ParsedHotelPayment = {
  /** 1-based row number in the spreadsheet, for messages. */
  rowNumber: number;
  eventName: string | null;
  eventType: string | null;
  hotelName: string | null;
  location: string | null;
  description: string | null;
  stayStart: string | null;
  stayEnd: string | null;
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
  /** Fields filled in from free text rather than their own column. */
  inferred: { location?: boolean; stay?: boolean };
};

export type HotelSheet = {
  headerIndex: number;
  headers: unknown[];
  bodyRows: unknown[][];
};

export type BuiltHotelFile = {
  payments: ParsedHotelPayment[];
  /** The file's own TOTAL row amount, if it has one. */
  statedTotal: number | null;
  /** Sum of rows with a readable amount. */
  computedTotal: number;
};

// --- Text ---

const PLACEHOLDER = /^(not specified|unspecified|n\/?a|nil|none|null|tbc|tbd|unknown|-+|–|—|\.)$/i;

/** Repairs mis-decoded dashes/quotes and tidies spacing. */
export function cleanText(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v)
    .replace(/â€“|�/g, "–")
    .replace(/â€”/g, "—")
    .replace(/â€™|â€˜/g, "'")
    .replace(/â€œ|â€\u009d|â€/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  if (!s || PLACEHOLDER.test(s)) return null;
  return s;
}

// --- Numbers ---

export function parseAmount(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 100) / 100 : null;
  const s = cleanText(v);
  if (!s) return null;
  const cleaned = s.replace(/kes|ksh?s?\.?|\/=|,|\s/gi, "");
  if (!/^-?\d+(\.\d+)?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100) / 100;
}

// --- Dates ---

const pad = (n: number) => String(n).padStart(2, "0");

function validYmd(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000;
  if (m < 1 || m > 12 || d < 1 || d > 31 || y < 1990 || y > 2100) return null;
  const dt = new Date(y, m - 1, d);
  if (dt.getMonth() !== m - 1) return null;
  return `${y}-${pad(m)}-${pad(d)}`;
}

const DMY = /(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})(?!\d)/g;

/** 'YYYY-MM-DD' from an Excel date, serial number or text date; null if
 * unreadable. */
export function parseDate(v: unknown): string | null {
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    // SheetJS dates can land a few seconds before midnight; round to the
    // nearest day before taking the calendar date.
    const d = new Date(v.getTime() + 12 * 3600 * 1000);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  if (typeof v === "number") {
    if (v < 20000 || v > 80000) return null;
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
  }
  const s = cleanText(v);
  if (!s) return null;
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) return validYmd(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  const dmy = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4}|\d{2})$/);
  if (dmy) return validYmd(Number(dmy[3]), Number(dmy[2]), Number(dmy[1]));
  if (/[a-z]/i.test(s)) {
    const t = Date.parse(s);
    if (!isNaN(t)) return parseDate(new Date(t));
  }
  return null;
}

/** Up to two day-first dates written in free text, in order. */
export function datesInText(text: string | null): string[] {
  if (!text) return [];
  const out: string[] = [];
  for (const m of Array.from(text.matchAll(DMY))) {
    const d = validYmd(Number(m[3]), Number(m[2]), Number(m[1]));
    if (d) out.push(d);
    if (out.length === 2) break;
  }
  return out;
}

export function formatDate(ymd: string | null): string {
  if (!ymd) return "";
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

// --- Locations ---

/** Kenya's 47 counties and the main towns - only these are read out of
 * free text, so an unrelated word never becomes a "location". */
const PLACES = [
  "Mombasa", "Kwale", "Kilifi", "Tana River", "Lamu", "Taita Taveta", "Garissa", "Wajir", "Mandera", "Marsabit",
  "Isiolo", "Meru", "Tharaka Nithi", "Embu", "Kitui", "Machakos", "Makueni", "Nyandarua", "Nyeri", "Kirinyaga",
  "Murang'a", "Muranga", "Kiambu", "Turkana", "West Pokot", "Samburu", "Trans Nzoia", "Uasin Gishu", "Elgeyo Marakwet",
  "Nandi", "Baringo", "Laikipia", "Nakuru", "Narok", "Kajiado", "Kericho", "Bomet", "Kakamega", "Vihiga", "Bungoma",
  "Busia", "Siaya", "Kisumu", "Homa Bay", "Migori", "Kisii", "Nyamira", "Nairobi",
  "Eldoret", "Thika", "Naivasha", "Gilgil", "Molo", "Nanyuki", "Nyahururu", "Malindi", "Watamu", "Diani", "Ukunda",
  "Kitale", "Kapsabet", "Iten", "Kabarnet", "Kapenguria", "Lodwar", "Maralal", "Ol Kalou", "Kerugoya", "Chuka",
  "Voi", "Wundanyi", "Hola", "Moyale", "Athi River", "Ruiru", "Limuru", "Karatina", "Mwea", "Kikuyu", "Ngong",
  "Kitengela", "Litein", "Sotik", "Webuye", "Mumias", "Bondo", "Mtwapa", "Kilgoris", "Keroka", "Wote", "Eldama Ravine",
];

const PLACE_RE = new RegExp(
  `\\b(${PLACES.slice().sort((a, b) => b.length - a.length).map((p) => p.replace(/[.*+?^${}()|[\]\\']/g, (c) => (c === "'" ? "'?" : `\\${c}`))).join("|")})\\b`,
  "i"
);

/** The first known county/town mentioned in the text, as spelt in PLACES. */
export function placeInText(text: string | null): string | null {
  if (!text) return null;
  const m = text.match(PLACE_RE);
  if (!m) return null;
  const hit = m[1].toLowerCase().replace(/'/g, "");
  return PLACES.find((p) => p.toLowerCase().replace(/'/g, "") === hit) ?? m[1];
}

// --- Sheet ---

/** Finds the header row (the first of the top 20 rows naming at least two
 * of Hotel / Payment Date / Amount, or three fields of any kind). */
export function readHotelSheet(rows: unknown[][]): HotelSheet | null {
  const limit = Math.min(rows.length, 20);
  for (let i = 0; i < limit; i++) {
    const fields = (rows[i] ?? []).map(guessHotelField).filter(Boolean) as HotelField[];
    const required = fields.filter((f) => REQUIRED_HOTEL_FIELDS.includes(f)).length;
    if (required >= 2 || new Set(fields).size >= 3) {
      return { headerIndex: i, headers: rows[i] ?? [], bodyRows: rows.slice(i + 1) };
    }
  }
  return null;
}

const TOTAL_RE = /^(grand )?totals?\b/i;

/** Applies a column mapping to the sheet's rows. */
export function buildHotelPayments(sheet: HotelSheet, columns: HotelColumnChoice[]): BuiltHotelFile {
  const colOf = (f: HotelField) => columns.findIndex((c) => c.kind === "field" && c.field === f);
  const idx = Object.fromEntries(
    (["event_name", "event_type", "hotel_name", "location", "description", "stay_start", "stay_end", "payment_date",
      "payment_method", "reference", "amount", "notes"] as HotelField[]).map((f) => [f, colOf(f)])
  ) as Record<HotelField, number>;
  const at = (row: unknown[], f: HotelField) => (idx[f] >= 0 ? row[idx[f]] : null);

  const payments: ParsedHotelPayment[] = [];
  let statedTotal: number | null = null;

  for (let r = 0; r < sheet.bodyRows.length; r++) {
    const row = sheet.bodyRows[r] ?? [];
    const filled = row.filter((c) => cleanText(c) !== null || typeof c === "number" || c instanceof Date);
    if (filled.length === 0) continue;

    // The file's own totals row ends the list.
    const isTotals = !cleanText(at(row, "hotel_name")) && row.some((c) => typeof c === "string" && TOTAL_RE.test(c.trim()));
    if (isTotals) {
      statedTotal = parseAmount(at(row, "amount"));
      break;
    }

    const hotelName = cleanText(at(row, "hotel_name"));
    const description = cleanText(at(row, "description"));
    const eventName = cleanText(at(row, "event_name"));
    const rawAmount = at(row, "amount");
    const amount = parseAmount(rawAmount);
    const rawPaid = at(row, "payment_date");
    const paymentDate = parseDate(rawPaid);

    const errors: string[] = [];
    const warnings: string[] = [];
    if (!hotelName) errors.push("No hotel name");
    if (!paymentDate) errors.push(cleanText(rawPaid) || rawPaid instanceof Date ? `Payment date "${String(rawPaid)}" isn't a date` : "No payment date");
    if (amount === null) errors.push(cleanText(rawAmount) ? `Amount "${String(rawAmount)}" isn't a number` : "No amount");
    else if (amount <= 0) errors.push("Amount must be above zero");

    const inferred: ParsedHotelPayment["inferred"] = {};

    let location = cleanText(at(row, "location"));
    if (!location) {
      location = placeInText(hotelName) ?? placeInText(description) ?? placeInText(eventName);
      if (location) inferred.location = true;
    }

    let stayStart = parseDate(at(row, "stay_start"));
    let stayEnd = parseDate(at(row, "stay_end"));
    if (!stayStart && !stayEnd) {
      const found = datesInText(description);
      if (found.length) {
        [stayStart, stayEnd] = [found[0], found[1] ?? null];
        inferred.stay = true;
      }
    }
    if (stayStart && stayEnd && stayEnd < stayStart) warnings.push("Stay end is before stay start");

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
      eventName,
      eventType: cleanText(at(row, "event_type")),
      hotelName,
      location,
      description,
      stayStart,
      stayEnd,
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

  const computedTotal = Math.round(payments.reduce((acc, p) => acc + (p.amount ?? 0), 0) * 100) / 100;
  return { payments, statedTotal, computedTotal };
}

/** Same key the import RPC uses to spot a payment already on file. */
export function hotelPaymentKey(hotelName: string, paymentDate: string, amount: number): string {
  return `${hotelName.replace(/\s+/g, " ").trim().toLowerCase()}|${paymentDate}|${Number(amount).toFixed(2)}`;
}
