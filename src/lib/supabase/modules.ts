/**
 * @file Client modules (0030_client_modules.sql) and the cross-module
 * platform totals behind each portal's Home Insights
 * (get_platform_totals, 0031_salary_payments.sql).
 */
import { supabase } from './client';
import type { SupabaseClient } from '@supabase/supabase-js';
import { MODULE_KEYS, type ModuleKey } from '../modules';

export type ClientModuleRow = { clientId: string; moduleKey: ModuleKey; enabled: boolean };

/**
 * Every client_modules row the caller can see (Super Admin+: all clients;
 * Organization Admin: their own). Returns null if the table doesn't exist
 * yet (0030 not applied) so callers can fall back to "Per Diem only" -
 * the app's behaviour before modules existed.
 */
export const getClientModules = async (client: SupabaseClient = supabase): Promise<ClientModuleRow[] | null> => {
  const { data, error } = await client.from('client_modules').select('client_id, module_key, enabled');
  if (error) {
    console.error('Error fetching client modules: ', error);
    return null;
  }
  return (data ?? []).map((r) => ({ clientId: r.client_id, moduleKey: r.module_key, enabled: r.enabled }));
};

/** Enabled module keys for one client, defaulting to Per Diem only when
 * modules can't be read (see getClientModules). */
export const getEnabledModulesForClient = async (clientId: string, client: SupabaseClient = supabase): Promise<ModuleKey[]> => {
  const { data, error } = await client
    .from('client_modules')
    .select('module_key')
    .eq('client_id', clientId)
    .eq('enabled', true);
  if (error) {
    console.error('Error fetching modules for client: ', error);
    return ['perdiem'];
  }
  const keys = (data ?? []).map((r) => r.module_key as ModuleKey);
  return MODULE_KEYS.filter((k) => keys.includes(k));
};

/** Switches a module on or off for a client. RLS restricts this to Super
 * Admin and above. Turning a module off hides it; its data is kept. */
export const setClientModule = async (clientId: string, moduleKey: ModuleKey, enabled: boolean): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('client_modules')
    .upsert(
      { client_id: clientId, module_key: moduleKey, enabled, updated_by: user?.id ?? null, updated_at: new Date().toISOString() },
      { onConflict: 'client_id,module_key' }
    );
  if (error) {
    throw error;
  }
};

export type PlatformTotalRow = {
  module: ModuleKey;
  clientId: string;
  /** 'YYYY-MM', or null for per diem rows whose date isn't a clean date. */
  month: string | null;
  amount: number;
  items: number;
};

/**
 * Headline amount per module x client x month: per diem paid out, salary
 * cost. Dates are inclusive 'YYYY-MM-DD'. Returns null if the function
 * isn't there yet (0031 not applied) so the Home page can say so instead
 * of showing zeros.
 */
export const getPlatformTotals = async (
  clientId: string | null,
  dateFrom: string | null,
  dateTo: string | null,
  client: SupabaseClient = supabase
): Promise<PlatformTotalRow[] | null> => {
  const { data, error } = await client.rpc('get_platform_totals', {
    target_client_id: clientId,
    p_date_from: dateFrom,
    p_date_to: dateTo,
  });
  if (error) {
    console.error('Error fetching platform totals: ', error);
    return null;
  }
  return ((data ?? []) as any[]).map((r) => ({
    module: r.module,
    clientId: r.client_id,
    month: r.month ?? null,
    amount: Number(r.amount) || 0,
    items: Number(r.items) || 0,
  }));
};
