import { FundingModuleLayout } from '@/app/admin/module-layouts';

/** A client's Refunds dashboard - redirects Home if the module is off (see module-layouts.tsx). */
export default async function ClientAdminFundingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clientSlug: string }>;
}) {
  const { clientSlug } = await params;
  return <FundingModuleLayout kind="client" clientSlug={clientSlug}>{children}</FundingModuleLayout>;
}
