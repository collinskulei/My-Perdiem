import { TravelModuleLayout } from '@/app/admin/module-layouts';

/** A client's Travel & Ground Transfers dashboard - redirects Home if the module is off (see module-layouts.tsx). */
export default async function ClientAdminTravelLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clientSlug: string }>;
}) {
  const { clientSlug } = await params;
  return <TravelModuleLayout kind="client" clientSlug={clientSlug}>{children}</TravelModuleLayout>;
}
