import { HotelsDashboard } from "@/app/admin/hotels/hotels-dashboard";

export const dynamic = "force-dynamic";

export default async function SuperAdminHotelsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  return <HotelsDashboard currentTab={params.tab || "overview"} />;
}
