-- Salary Payments: Employees tab shows Total Gross / Total Deductions /
-- Total Net per employee. Adds the deduction sums to
-- get_salary_employee_summaries (0031).
--
-- Read-only: replaces one stable, security-invoker query function. No
-- table, row or policy changes; safe to re-run.
--
--   total_deductions = employee statutory (PAYE, NSSF, SHIF, Housing Levy)
--                    + other deductions (SACCO, recoveries...).
--   Employer contributions are not deductions from the employee's pay and
--   are excluded.
--
-- Summed from each line's stored totals rather than derived as gross - net,
-- so a month whose own figures don't add up is reported as the file stated.

create or replace function public.get_salary_employee_summaries(p_employer_id uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(jsonb_agg(to_jsonb(s) order by s.staff_no), '[]'::jsonb)
  from (
    select
      emp.id as employee_id, emp.staff_no, emp.name,
      min(r.period) as first_period,
      max(r.period) as last_period,
      count(l.id) as months_paid,
      coalesce(sum(l.gross_pay), 0) as total_gross,
      coalesce(sum(l.total_statutory), 0) as total_statutory,
      coalesce(sum(l.total_other_deductions), 0) as total_other_deductions,
      coalesce(sum(l.total_statutory + l.total_other_deductions), 0) as total_deductions,
      coalesce(sum(l.net_pay), 0) as total_net,
      (array_agg(l.gross_pay order by r.period desc))[1] as latest_gross,
      (array_agg(l.net_pay order by r.period desc))[1] as latest_net
    from public.salary_employees emp
    left join public.salary_lines l on l.employee_id = emp.id
    left join public.salary_runs r on r.id = l.run_id
    where emp.employer_id = p_employer_id
    group by emp.id
  ) s
$$;
