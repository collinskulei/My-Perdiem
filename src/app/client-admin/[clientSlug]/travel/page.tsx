import { TravelDashboard } from "@/app/admin/travel/travel-dashboard";

export const dynamic = "force-dynamic";

export default async function ClientAdminTravelPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  return <TravelDashboard currentTab={params.tab || "overview"} />;
}
