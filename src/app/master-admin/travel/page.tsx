import { TravelDashboard } from "@/app/admin/travel/travel-dashboard";

export const dynamic = "force-dynamic";

export default async function MasterAdminTravelPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  return <TravelDashboard currentTab={params.tab || "overview"} />;
}
