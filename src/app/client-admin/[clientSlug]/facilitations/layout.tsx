import { FacilitationsModuleLayout } from '@/app/admin/module-layouts';

/** A client's Other Project Facilitations dashboard - redirects Home if none of its submodules is on (see module-layouts.tsx). */
export default async function ClientAdminFacilitationsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clientSlug: string }>;
}) {
  const { clientSlug } = await params;
  return <FacilitationsModuleLayout kind="client" clientSlug={clientSlug}>{children}</FacilitationsModuleLayout>;
}
