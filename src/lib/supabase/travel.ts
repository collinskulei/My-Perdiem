/**
 * @file Travel & Ground Transfers module data access
 * (0038_travel_payments.sql). Reads and edits go through RLS (Super
 * Admin+, or the client's own Organization Admin, and only while the
 * module is on); uploads go through import_travel_payments, which
 * re-checks access and skips payments already on file.
 */
import { supabase } from './client';
import type { ParsedTravelPayment } from '../travel/parse';

export type TravelPayment = {
  id: string;
  clientId: string;
  batchId: string | null;
  description: string;
  paymentType: string | null;
  route: string | null;
  supplier: string | null;
  eventName: string | null;
  travelDate: string | null;
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

export type TravelImportBatch = {
  id: string;
  clientId: string;
  sourceFileName: string | null;
  rowCount: number;
  totalAmount: number;
  statedTotal: number | null;
  importedAt: string;
};

/** The editable fields of a payment (also what "Add payment" sends). */
export type TravelPaymentInput = Pick<TravelPayment,
  'description' | 'paymentType' | 'route' | 'supplier' | 'eventName' | 'travelDate' |
  'paymentDate' | 'paymentMethod' | 'reference' | 'amount' | 'notes'
>;

const mapPayment = (r: any): TravelPayment => ({
  id: r.id,
  clientId: r.client_id,
  batchId: r.batch_id ?? null,
  description: r.description,
  paymentType: r.payment_type ?? null,
  route: r.route ?? null,
  supplier: r.supplier ?? null,
  eventName: r.event_name ?? null,
  travelDate: r.travel_date ?? null,
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

const toRow = (p: TravelPaymentInput) => ({
  description: p.description.trim(),
  payment_type: p.paymentType || null,
  route: p.route || null,
  supplier: p.supplier || null,
  event_name: p.eventName || null,
  travel_date: p.travelDate || null,
  payment_date: p.paymentDate,
  payment_method: p.paymentMethod || null,
  reference: p.reference || null,
  amount: p.amount,
  notes: p.notes || null,
});

/**
 * Every payment for a client, newest first - loaded whole and filtered in
 * the browser, like hotel payments. Returns null if the table isn't there
 * (0038 not applied).
 */
export const getTravelPayments = async (clientId: string): Promise<TravelPayment[] | null> => {
  const out: TravelPayment[] = [];
  const PAGE = 1000;
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('travel_payments')
      .select('*')
      .eq('client_id', clientId)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) {
      console.error('Error fetching travel payments: ', error);
      return null;
    }
    out.push(...(data ?? []).map(mapPayment));
    if (!data || data.length < PAGE) break;
  }
  return out;
};

export const getTravelImportBatches = async (clientId: string): Promise<TravelImportBatch[]> => {
  const { data, error } = await supabase
    .from('travel_import_batches')
    .select('*')
    .eq('client_id', clientId)
    .order('imported_at', { ascending: false });
  if (error) {
    console.error('Error fetching travel import batches: ', error);
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

export type ImportTravelPaymentsResult = {
  batchId: string | null;
  inserted: number;
  /** Indexes into the rows sent that were skipped as already on file. */
  skipped: number[];
};

export const importTravelPayments = async (args: {
  clientId: string;
  sourceFileName: string;
  rows: (ParsedTravelPayment & { force?: boolean })[];
  statedTotal: number | null;
}): Promise<ImportTravelPaymentsResult> => {
  const { data, error } = await supabase.rpc('import_travel_payments', {
    p_client_id: args.clientId,
    p_source_file_name: args.sourceFileName,
    p_stated_total: args.statedTotal,
    p_rows: args.rows.map((p) => ({
      description: p.description,
      paymentType: p.paymentType,
      route: p.route,
      supplier: p.supplier,
      eventName: p.eventName,
      travelDate: p.travelDate,
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

export const addTravelPayment = async (clientId: string, p: TravelPaymentInput): Promise<TravelPayment> => {
  const { data, error } = await supabase
    .from('travel_payments')
    .insert({ client_id: clientId, ...toRow(p) })
    .select('*')
    .single();
  if (error || !data) throw error ?? new Error('Failed to add payment');
  return mapPayment(data);
};

export const updateTravelPayment = async (id: string, p: TravelPaymentInput): Promise<TravelPayment> => {
  const { data, error } = await supabase
    .from('travel_payments')
    .update(toRow(p))
    .eq('id', id)
    .select('*')
    .single();
  if (error || !data) throw error ?? new Error('Failed to save payment');
  return mapPayment(data);
};

/** Super Admin and above (RLS). */
export const deleteTravelPayments = async (ids: string[]): Promise<void> => {
  const { error } = await supabase.from('travel_payments').delete().in('id', ids);
  if (error) throw error;
};

/** Removes an upload and every payment it brought in. Super Admin and above (RLS). */
export const deleteTravelImportBatch = async (batchId: string): Promise<void> => {
  const { error } = await supabase.from('travel_import_batches').delete().eq('id', batchId);
  if (error) throw error;
};
