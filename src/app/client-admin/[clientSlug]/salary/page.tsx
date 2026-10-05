import { SalaryDashboard } from "@/app/admin/salary/salary-dashboard";

export const dynamic = "force-dynamic";

export default async function ClientAdminSalaryPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  return <SalaryDashboard currentTab={params.tab || "overview"} />;
}
