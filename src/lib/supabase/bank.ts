/**
 * @file Per diem Bank Balance data access (0040_perdiem_bank_balance.sql).
 * Top-ups are bank deposits per client; the balance is top-ups minus per
 * diem paid on or after the client's first top-up date. Viewing goes
 * through RLS (Super/Master Admin, or the client's own Organization
 * Admin); adding, editing and deleting top-ups is Super/Master Admin only.
 */
import { supabase } from './client';

export type BankTopup = {
  id: string;
  clientId: string;
  amount: number;
  depositDate: string;
  reference: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
};

export type BankTopupInput = Pick<BankTopup, 'amount' | 'depositDate' | 'reference' | 'notes'>;

export type BankBalance = {
  clientId: string;
  startDate: string;
  lastTopupDate: string;
  topupsTotal: number;
  topupCount: number;
  paidTotal: number;
  paidCount: number;
  balance: number;
  pendingAmount: number;
  pendingCount: number;
  /** Per diem paid per day since startDate - only filled for a single-client fetch. */
  daily: { date: string; amount: number; count: number }[];
};

const mapTopup = (r: any): BankTopup => ({
  id: r.id,
  clientId: r.client_id,
  amount: Number(r.amount) || 0,
  depositDate: r.deposit_date,
  reference: r.reference ?? null,
  notes: r.notes ?? null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

const toRow = (p: BankTopupInput) => ({
  amount: p.amount,
  deposit_date: p.depositDate,
  reference: p.reference?.trim() || null,
  notes: p.notes?.trim() || null,
});

const mapBalance = (b: any): BankBalance => ({
  clientId: b.client_id,
  startDate: b.start_date,
  lastTopupDate: b.last_topup_date,
  topupsTotal: Number(b.topups_total) || 0,
  topupCount: Number(b.topup_count) || 0,
  paidTotal: Number(b.paid_total) || 0,
  paidCount: Number(b.paid_count) || 0,
  balance: Number(b.balance) || 0,
  pendingAmount: Number(b.pending_amount) || 0,
  pendingCount: Number(b.pending_count) || 0,
  daily: (b.daily ?? []).map((d: any) => ({ date: d.date, amount: Number(d.amount) || 0, count: Number(d.count) || 0 })),
});

/** Every top-up for a client, newest first. null if 0040 isn't applied. */
export const getBankTopups = async (clientId: string): Promise<BankTopup[] | null> => {
  const { data, error } = await supabase
    .from('perdiem_bank_topups')
    .select('*')
    .eq('client_id', clientId)
    .order('deposit_date', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Error fetching bank top-ups: ', error);
    return null;
  }
  return (data ?? []).map(mapTopup);
};

/**
 * Balances for every client the caller can see that has a top-up (or one
 * client, with its daily payments). null if 0040 isn't applied.
 */
export const getBankBalances = async (clientId: string | null = null): Promise<BankBalance[] | null> => {
  const { data, error } = await supabase.rpc('get_perdiem_bank_balances', { target_client_id: clientId });
  if (error) {
    console.error('Error fetching bank balances: ', error);
    return null;
  }
  return ((data as any[]) ?? []).map(mapBalance);
};

/** Super/Master Admin only (RLS). */
export const addBankTopup = async (clientId: string, p: BankTopupInput): Promise<BankTopup> => {
  const { data, error } = await supabase
    .from('perdiem_bank_topups')
    .insert({ client_id: clientId, ...toRow(p) })
    .select('*')
    .single();
  if (error || !data) throw error ?? new Error('Failed to add top-up');
  return mapTopup(data);
};

/** Super/Master Admin only (RLS). */
export const updateBankTopup = async (id: string, p: BankTopupInput): Promise<BankTopup> => {
  const { data, error } = await supabase
    .from('perdiem_bank_topups')
    .update(toRow(p))
    .eq('id', id)
    .select('*')
    .single();
  if (error || !data) throw error ?? new Error('Failed to save top-up');
  return mapTopup(data);
};

/** Super/Master Admin only (RLS). */
export const deleteBankTopup = async (id: string): Promise<void> => {
  const { error } = await supabase.from('perdiem_bank_topups').delete().eq('id', id);
  if (error) throw error;
};
