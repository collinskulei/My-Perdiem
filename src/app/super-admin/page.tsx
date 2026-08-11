/**
 * @file Super Admin's dedicated login portal (see docs/MILESTONE_HANDOFF.md
 * for the tier-portal rationale). Distinct from the participant landing page
 * and the Client Admin/Master Admin portals - Super Admins sign in here only.
 */
import { AdminLoginForm } from "@/components/admin-login-form";

export default function SuperAdminLoginPage() {
  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-background p-4">
      <AdminLoginForm
        title="Super Admin"
        description="Sign in to manage clients across the platform."
        expectedTier="super_admin"
        redirectTo="/super-admin/dashboard"
      />
    </div>
  );
}
