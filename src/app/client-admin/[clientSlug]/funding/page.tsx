import { FundingDashboard } from "@/app/admin/funding/funding-dashboard";

export const dynamic = "force-dynamic";

export default async function ClientAdminFundingPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  return <FundingDashboard currentTab={params.tab || "overview"} />;
}
