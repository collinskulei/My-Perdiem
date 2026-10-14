/**
 * @file Refunds module data access (0037_funding_receipts.sql): refund
 * payments made, one per invoice (receivedDate is the payment date).
 * Reads and edits go through RLS (Super Admin+, or the client's own
 * Organization Admin, and only while the module is on). An invoice number
 * is unique per client, so the same invoice can't be recorded twice.
 */
import { supabase } from './client';

export type FundingReceipt = {
  id: string;
  clientId: string;
  invoiceNo: string | null;
  description: string;
  payer: string | null;
  amount: number;
  receivedDate: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

/** The editable fields of a receipt (also what "Add receipt" sends). */
export type FundingReceiptInput = Pick<FundingReceipt,
  'invoiceNo' | 'description' | 'payer' | 'amount' | 'receivedDate' | 'reference' | 'notes'
>;

const mapReceipt = (r: any): FundingReceipt => ({
  id: r.id,
  clientId: r.client_id,
  invoiceNo: r.invoice_no ?? null,
  description: r.description,
  payer: r.payer ?? null,
  amount: Number(r.amount) || 0,
  receivedDate: r.received_date,
  reference: r.reference ?? null,
  notes: r.notes ?? null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toRow = (p: FundingReceiptInput) => ({
  invoice_no: p.invoiceNo?.trim() || null,
  description: p.description.trim(),
  payer: p.payer?.trim() || null,
  amount: p.amount,
  received_date: p.receivedDate,
  reference: p.reference?.trim() || null,
  notes: p.notes || null,
});

/** Postgres unique violation on funding_receipts_invoice_uniq, in words. */
const friendly = (error: any, fallback: string): Error =>
  error?.code === '23505'
    ? new Error('That invoice number is already recorded for this client.')
    : error ?? new Error(fallback);

/**
 * Every receipt for a client, newest first. Returns null if the table
 * isn't there (0037 not applied).
 */
export const getFundingReceipts = async (clientId: string): Promise<FundingReceipt[] | null> => {
  const { data, error } = await supabase
    .from('funding_receipts')
    .select('*')
    .eq('client_id', clientId)
    .order('received_date', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) {
    console.error('Error fetching funding receipts: ', error);
    return null;
  }
  return (data ?? []).map(mapReceipt);
};

export const addFundingReceipt = async (clientId: string, p: FundingReceiptInput): Promise<FundingReceipt> => {
  const { data, error } = await supabase
    .from('funding_receipts')
    .insert({ client_id: clientId, ...toRow(p) })
    .select('*')
    .single();
  if (error || !data) throw friendly(error, 'Failed to add receipt');
  return mapReceipt(data);
};

export const updateFundingReceipt = async (id: string, p: FundingReceiptInput): Promise<FundingReceipt> => {
  const { data, error } = await supabase
    .from('funding_receipts')
    .update(toRow(p))
    .eq('id', id)
    .select('*')
    .single();
  if (error || !data) throw friendly(error, 'Failed to save receipt');
  return mapReceipt(data);
};

/** Super Admin and above (RLS). */
export const deleteFundingReceipts = async (ids: string[]): Promise<void> => {
  const { error } = await supabase.from('funding_receipts').delete().in('id', ids);
  if (error) throw error;
};
