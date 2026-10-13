import { HotelsModuleLayout } from '@/app/admin/module-layouts';

/** A client's Hotel Bookings dashboard - redirects Home if the module is off (see module-layouts.tsx). */
export default async function ClientAdminHotelsLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clientSlug: string }>;
}) {
  const { clientSlug } = await params;
  return <HotelsModuleLayout kind="client" clientSlug={clientSlug}>{children}</HotelsModuleLayout>;
}
