/**
 * @file Hotel Bookings module data access (0036_hotel_payments.sql). Reads
 * and edits go through RLS (Super Admin+, or the client's own
 * Organization Admin, and only while the module is on); uploads go
 * through import_hotel_payments, which re-checks access and skips
 * payments already on file.
 */
import { supabase } from './client';
import type { ParsedHotelPayment } from '../hotels/parse';

export type HotelPayment = {
  id: string;
  clientId: string;
  batchId: string | null;
  eventName: string | null;
  eventType: string | null;
  hotelName: string;
  location: string | null;
  description: string | null;
  stayStart: string | null;
  stayEnd: string | null;
  paymentDate: string;
  paymentMethod: string | null;
  reference: string | null;
  amount: number;
  notes: string | null;
  extra: Record<string, string | number>;
  warnings: string[];
  createdAt: string;
  updatedAt: string;
};

export type HotelImportBatch = {
  id: string;
  clientId: string;
  sourceFileName: string | null;
  rowCount: number;
  totalAmount: number;
  statedTotal: number | null;
  importedAt: string;
};

/** The editable fields of a payment (also what "Add payment" sends). */
export type HotelPaymentInput = Pick<HotelPayment,
  'eventName' | 'eventType' | 'hotelName' | 'location' | 'description' | 'stayStart' | 'stayEnd' |
  'paymentDate' | 'paymentMethod' | 'reference' | 'amount' | 'notes'
>;

const mapPayment = (r: any): HotelPayment => ({
  id: r.id,
  clientId: r.client_id,
  batchId: r.batch_id ?? null,
  eventName: r.event_name ?? null,
  eventType: r.event_type ?? null,
  hotelName: r.hotel_name,
  location: r.location ?? null,
  description: r.description ?? null,
  stayStart: r.stay_start ?? null,
  stayEnd: r.stay_end ?? null,
  paymentDate: r.payment_date,
  paymentMethod: r.payment_method ?? null,
  reference: r.reference ?? null,
  amount: Number(r.amount) || 0,
  notes: r.notes ?? null,
  extra: r.extra ?? {},
  warnings: r.warnings ?? [],
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toRow = (p: HotelPaymentInput) => ({
  event_name: p.eventName || null,
  event_type: p.eventType || null,
  hotel_name: p.hotelName.trim(),
  location: p.location || null,
  description: p.description || null,
  stay_start: p.stayStart || null,
  stay_end: p.stayEnd || null,
  payment_date: p.paymentDate,
  payment_method: p.paymentMethod || null,
  reference: p.reference || null,
  amount: p.amount,
  notes: p.notes || null,
});

/**
 * Every payment for a client, newest first. A client's hotel payments run
 * to hundreds, not hundreds of thousands, so the dashboard loads them all
 * and filters/rolls up in the browser. Returns null if the table isn't
 * there (0036 not applied).
 */
export const getHotelPayments = async (clientId: string): Promise<HotelPayment[] | null> => {
  const out: HotelPayment[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('hotel_payments')
      .select('*')
      .eq('client_id', clientId)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error('Error fetching hotel payments: ', error);
      return null;
    }
    out.push(...(data ?? []).map(mapPayment));
    if (!data || data.length < PAGE) break;
  }
  return out;
};

export const getHotelImportBatches = async (clientId: string): Promise<HotelImportBatch[]> => {
  const { data, error } = await supabase
    .from('hotel_import_batches')
    .select('*')
    .eq('client_id', clientId)
    .order('imported_at', { ascending: false });
  if (error) {
    console.error('Error fetching hotel import batches: ', error);
    return [];
  }
  return (data ?? []).map((r: any) => ({
    id: r.id,
    clientId: r.client_id,
    sourceFileName: r.source_file_name ?? null,
    rowCount: r.row_count,
    totalAmount: Number(r.total_amount) || 0,
    statedTotal: r.stated_total === null ? null : Number(r.stated_total),
    importedAt: r.imported_at,
  }));
};

export type ImportHotelPaymentsResult = {
  batchId: string | null;
  inserted: number;
  /** Indexes into the rows sent that were skipped as already on file. */
  skipped: number[];
};

export const importHotelPayments = async (args: {
  clientId: string;
  sourceFileName: string;
  rows: (ParsedHotelPayment & { force?: boolean })[];
  statedTotal: number | null;
}): Promise<ImportHotelPaymentsResult> => {
  const { data, error } = await supabase.rpc('import_hotel_payments', {
    p_client_id: args.clientId,
    p_source_file_name: args.sourceFileName,
    p_stated_total: args.statedTotal,
    p_rows: args.rows.map((p) => ({
      eventName: p.eventName,
      eventType: p.eventType,
      hotelName: p.hotelName,
      location: p.location,
      description: p.description,
      stayStart: p.stayStart,
      stayEnd: p.stayEnd,
      paymentDate: p.paymentDate,
      paymentMethod: p.paymentMethod,
      reference: p.reference,
      amount: p.amount,
      notes: p.notes,
      extra: p.extra,
      warnings: p.warnings,
      force: !!p.force,
    })),
  });
  if (error || !data) throw error ?? new Error('Import failed');
  return {
    batchId: data.batch_id ?? null,
    inserted: Number(data.inserted) || 0,
    skipped: (data.skipped ?? []).map(Number),
  };
};

export const addHotelPayment = async (clientId: string, p: HotelPaymentInput): Promise<HotelPayment> => {
  const { data, error } = await supabase
    .from('hotel_payments')
    .insert({ client_id: clientId, ...toRow(p) })
    .select('*')
    .single();
  if (error || !data) throw error ?? new Error('Failed to add payment');
  return mapPayment(data);
};

export const updateHotelPayment = async (id: string, p: HotelPaymentInput): Promise<HotelPayment> => {
  const { data, error } = await supabase
    .from('hotel_payments')
    .update(toRow(p))
    .eq('id', id)
    .select('*')
    .single();
  if (error || !data) throw error ?? new Error('Failed to save payment');
  return mapPayment(data);
};

/** Super Admin and above (RLS). */
export const deleteHotelPayments = async (ids: string[]): Promise<void> => {
  const { error } = await supabase.from('hotel_payments').delete().in('id', ids);
  if (error) throw error;
};

/** Removes an upload and every payment it brought in. Super Admin and above (RLS). */
export const deleteHotelImportBatch = async (batchId: string): Promise<void> => {
  const { error } = await supabase.from('hotel_import_batches').delete().eq('id', batchId);
  if (error) throw error;
};
