/**
 * @file Salary Payments module data access (0031_salary_payments.sql). Kept
 * out of database.ts, which is already the per diem module's home and
 * large enough. Reads go through RLS (Super Admin+, or the client's own
 * Organization Admin, and only while the module is on); writes that
 * matter go through the security definer RPCs, which re-check access.
 */
import { supabase } from './client';
import type { SalaryLineInput } from '../salary/parse';
import type { SalaryTemplate, SalaryTemplateColumn } from '../salary/fields';

export type SalaryEmployer = {
  id: string;
  clientId: string;
  name: string;
  createdAt: string;
};

const mapEmployer = (r: any): SalaryEmployer => ({
  id: r.id,
  clientId: r.client_id,
  name: r.name,
  createdAt: r.created_at,
});

/** Active employers, optionally for one client. */
export const getSalaryEmployers = async (clientId: string | null): Promise<SalaryEmployer[]> => {
  let q = supabase.from('salary_employers').select('*').is('archived_at', null).order('name');
  if (clientId) q = q.eq('client_id', clientId);
  const { data, error } = await q;
  if (error) {
    console.error('Error fetching salary employers: ', error);
    return [];
  }
  return (data ?? []).map(mapEmployer);
};

export const addSalaryEmployer = async (clientId: string, name: string): Promise<SalaryEmployer> => {
  const { data, error } = await supabase
    .from('salary_employers')
    .insert({ client_id: clientId, name })
    .select('*')
    .single();
  if (error || !data) {
    if (error?.code === '23505') throw new Error(`An employer named "${name}" already exists for this client.`);
    throw error ?? new Error('Failed to add employer');
  }
  return mapEmployer(data);
};

export const updateSalaryEmployer = async (id: string, fields: { name: string }): Promise<void> => {
  const { error } = await supabase
    .from('salary_employers')
    .update({ name: fields.name })
    .eq('id', id);
  if (error) throw error;
};

/** Hides an employer (its runs stay on record). */
export const archiveSalaryEmployer = async (id: string): Promise<void> => {
  const { error } = await supabase.from('salary_employers').update({ archived_at: new Date().toISOString() }).eq('id', id);
  if (error) throw error;
};

const mapTemplate = (r: any): SalaryTemplate => ({
  id: r.id,
  employerId: r.employer_id,
  version: r.version,
  columns: r.columns ?? [],
  totalsMarker: r.totals_marker,
  sampleFileName: r.sample_file_name ?? null,
  notes: r.notes ?? null,
  createdAt: r.created_at,
});

/** Every template version for an employer, newest first. */
export const getSalaryTemplates = async (employerId: string): Promise<SalaryTemplate[]> => {
  const { data, error } = await supabase
    .from('salary_templates')
    .select('*')
    .eq('employer_id', employerId)
    .order('version', { ascending: false });
  if (error) {
    console.error('Error fetching salary templates: ', error);
    return [];
  }
  return (data ?? []).map(mapTemplate);
};

/** Appends a new template version (the first one needs Super Admin). */
export const saveSalaryTemplate = async (
  employerId: string,
  columns: SalaryTemplateColumn[],
  opts: { totalsMarker?: string; sampleFileName?: string | null; notes?: string | null } = {}
): Promise<SalaryTemplate> => {
  const { data, error } = await supabase.rpc('save_salary_template', {
    p_employer_id: employerId,
    p_columns: columns,
    p_totals_marker: opts.totalsMarker ?? 'Grand Totals',
    p_sample_file_name: opts.sampleFileName ?? null,
    p_notes: opts.notes ?? null,
  });
  if (error || !data) throw error ?? new Error('Failed to save template');
  return mapTemplate(Array.isArray(data) ? data[0] : data);
};

/** Thrown when the month is already on file and replace wasn't asked for. */
export class SalaryRunExistsError extends Error {}

export type ImportSalaryRunResult = {
  runId: string;
  employeeCount: number;
  newEmployeeCount: number;
  replaced: boolean;
};

export const importSalaryRun = async (args: {
  employerId: string;
  /** 'YYYY-MM-01' */
  period: string;
  templateId: string;
  sourceFileName: string;
  statedTotals: Record<string, number>;
  totalsMismatch: boolean;
  lines: SalaryLineInput[];
  replace: boolean;
}): Promise<ImportSalaryRunResult> => {
  const rows = args.lines.map(({ rowNumber: _r, errors: _e, ...line }) => line);
  const { data, error } = await supabase.rpc('import_salary_run', {
    p_employer_id: args.employerId,
    p_period: args.period,
    p_template_id: args.templateId,
    p_source_file_name: args.sourceFileName,
    p_stated_totals: args.statedTotals,
    p_totals_mismatch: args.totalsMismatch,
    p_rows: rows,
    p_replace: args.replace,
  });
  if (error) {
    if (error.message?.includes('RUN_EXISTS')) throw new SalaryRunExistsError(error.message.replace(/^.*RUN_EXISTS:\s*\S+\s*/, ''));
    throw error;
  }
  const r = (Array.isArray(data) ? data[0] : data) as any;
  return {
    runId: r.run_id,
    employeeCount: r.employee_count,
    newEmployeeCount: r.new_employee_count,
    replaced: r.replaced,
  };
};

export type SalaryRunSummary = {
  runId: string;
  employerId: string;
  employerName: string;
  clientId: string;
  /** 'YYYY-MM-01' */
  period: string;
  sourceFileName: string | null;
  importedAt: string;
  templateId: string | null;
  totalsMismatch: boolean;
  warningCount: number;
  statedTotals: Record<string, number>;
  headcount: number;
  basicPay: number;
  commuterAllowance: number;
  houseAllowance: number;
  grossPay: number;
  housingLevy: number;
  nssf: number;
  shif: number;
  paye: number;
  totalStatutory: number;
  totalOtherDeductions: number;
  netPay: number;
  employerHousingLevy: number;
  employerNita: number;
  employerNssf: number;
  salaryCost: number;
  otherDeductionTotals: Record<string, number>;
  otherEarningTotals: Record<string, number>;
};

const num = (v: any) => Number(v) || 0;
const numBag = (o: any): Record<string, number> =>
  Object.fromEntries(Object.entries(o ?? {}).map(([k, v]) => [k, num(v)]));

/** One row per employer-month, newest first. */
export const getSalaryRunSummaries = async (clientId: string | null, employerId: string | null = null): Promise<SalaryRunSummary[] | null> => {
  const { data, error } = await supabase.rpc('get_salary_run_summaries', {
    target_client_id: clientId,
    p_employer_id: employerId,
  });
  if (error) {
    console.error('Error fetching salary runs: ', error);
    return null;
  }
  return ((data ?? []) as any[]).map((r) => ({
    runId: r.run_id,
    employerId: r.employer_id,
    employerName: r.employer_name,
    clientId: r.client_id,
    period: String(r.period).slice(0, 10),
    sourceFileName: r.source_file_name ?? null,
    importedAt: r.imported_at,
    templateId: r.template_id ?? null,
    totalsMismatch: !!r.totals_mismatch,
    warningCount: num(r.warning_count),
    statedTotals: numBag(r.stated_totals),
    headcount: num(r.headcount),
    basicPay: num(r.basic_pay),
    commuterAllowance: num(r.commuter_allowance),
    houseAllowance: num(r.house_allowance),
    grossPay: num(r.gross_pay),
    housingLevy: num(r.housing_levy),
    nssf: num(r.nssf),
    shif: num(r.shif),
    paye: num(r.paye),
    totalStatutory: num(r.total_statutory),
    totalOtherDeductions: num(r.total_other_deductions),
    netPay: num(r.net_pay),
    employerHousingLevy: num(r.employer_housing_levy),
    employerNita: num(r.employer_nita),
    employerNssf: num(r.employer_nssf),
    salaryCost: num(r.salary_cost),
    otherDeductionTotals: numBag(r.other_deduction_totals),
    otherEarningTotals: numBag(r.other_earning_totals),
  }));
};

export type SalaryLine = {
  id: number;
  runId: string;
  employeeId: string;
  /** 'YYYY-MM-01' - only filled by getSalaryEmployeeHistory. */
  period?: string;
  staffNo: string;
  employeeName: string;
  basicPay: number;
  commuterAllowance: number;
  houseAllowance: number;
  otherEarnings: Record<string, number>;
  grossPay: number;
  housingLevy: number;
  nssf: number;
  shif: number;
  paye: number;
  totalStatutory: number;
  otherDeductions: Record<string, number>;
  totalOtherDeductions: number;
  netPay: number;
  employerHousingLevy: number;
  employerNita: number;
  employerNssf: number;
  warnings: string[];
};

const mapLine = (r: any): SalaryLine => ({
  id: r.id,
  runId: r.run_id,
  employeeId: r.employee_id,
  period: r.salary_runs?.period ? String(r.salary_runs.period).slice(0, 10) : undefined,
  staffNo: r.staff_no,
  employeeName: r.employee_name,
  basicPay: num(r.basic_pay),
  commuterAllowance: num(r.commuter_allowance),
  houseAllowance: num(r.house_allowance),
  otherEarnings: numBag(r.other_earnings),
  grossPay: num(r.gross_pay),
  housingLevy: num(r.housing_levy),
  nssf: num(r.nssf),
  shif: num(r.shif),
  paye: num(r.paye),
  totalStatutory: num(r.total_statutory),
  otherDeductions: numBag(r.other_deductions),
  totalOtherDeductions: num(r.total_other_deductions),
  netPay: num(r.net_pay),
  employerHousingLevy: num(r.employer_housing_levy),
  employerNita: num(r.employer_nita),
  employerNssf: num(r.employer_nssf),
  warnings: r.warnings ?? [],
});

export const getSalaryRunLines = async (runId: string): Promise<SalaryLine[]> => {
  const { data, error } = await supabase.from('salary_lines').select('*').eq('run_id', runId).order('staff_no');
  if (error) {
    console.error('Error fetching salary lines: ', error);
    return [];
  }
  return (data ?? []).map(mapLine);
};

/** Every month on file for one employee, newest first. */
export const getSalaryEmployeeHistory = async (employeeId: string): Promise<SalaryLine[]> => {
  const { data, error } = await supabase
    .from('salary_lines')
    .select('*, salary_runs(period)')
    .eq('employee_id', employeeId);
  if (error) {
    console.error('Error fetching employee history: ', error);
    return [];
  }
  return (data ?? []).map(mapLine).sort((a, b) => (b.period ?? '').localeCompare(a.period ?? ''));
};

export type SalaryEmployeeSummary = {
  employeeId: string;
  staffNo: string;
  name: string;
  firstPeriod: string | null;
  lastPeriod: string | null;
  monthsPaid: number;
  totalGross: number;
  /** Statutory + other deductions (0032); 0 until that migration is applied. */
  totalDeductions: number;
  totalNet: number;
  latestGross: number | null;
  latestNet: number | null;
};

export const getSalaryEmployeeSummaries = async (employerId: string): Promise<SalaryEmployeeSummary[]> => {
  const { data, error } = await supabase.rpc('get_salary_employee_summaries', { p_employer_id: employerId });
  if (error) {
    console.error('Error fetching salary employees: ', error);
    return [];
  }
  return ((data ?? []) as any[]).map((r) => ({
    employeeId: r.employee_id,
    staffNo: r.staff_no,
    name: r.name,
    firstPeriod: r.first_period ? String(r.first_period).slice(0, 10) : null,
    lastPeriod: r.last_period ? String(r.last_period).slice(0, 10) : null,
    monthsPaid: num(r.months_paid),
    totalGross: num(r.total_gross),
    totalDeductions: num(r.total_deductions),
    totalNet: num(r.total_net),
    latestGross: r.latest_gross == null ? null : num(r.latest_gross),
    latestNet: r.latest_net == null ? null : num(r.latest_net),
  }));
};

/** Removes one month (and its lines). RLS: Super Admin and above. */
export const deleteSalaryRun = async (runId: string): Promise<void> => {
  const { data, error } = await supabase.from('salary_runs').delete().eq('id', runId).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Only Super Admins can delete a salary month.');
};
