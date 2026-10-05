import { SalaryModuleLayout } from '@/app/admin/module-layouts';

/** A client's Salary Payments dashboard - redirects Home if the module is off (see module-layouts.tsx). */
export default async function ClientAdminSalaryLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clientSlug: string }>;
}) {
  const { clientSlug } = await params;
  return <SalaryModuleLayout kind="client" clientSlug={clientSlug}>{children}</SalaryModuleLayout>;
}
