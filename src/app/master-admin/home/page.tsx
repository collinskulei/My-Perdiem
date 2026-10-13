import { HomeDashboard } from "@/app/admin/home-manage";

export const dynamic = "force-dynamic";

export default async function MasterAdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  return <HomeDashboard currentTab={params.tab || "overview"} />;
}
