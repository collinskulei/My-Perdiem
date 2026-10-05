import { HomeModuleLayout } from '@/app/admin/module-layouts';

/** A client's Home - that client's overall Insights and its modules (see module-layouts.tsx). */
export default async function ClientAdminHomeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ clientSlug: string }>;
}) {
  const { clientSlug } = await params;
  return <HomeModuleLayout kind="client" clientSlug={clientSlug}>{children}</HomeModuleLayout>;
}
