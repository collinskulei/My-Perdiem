/**
 * @file Master Admin's dedicated login portal - distinct from the
 * participant landing page and the Client/Super Admin portals.
 */
import { AdminLoginForm } from "@/components/admin-login-form";

export default function MasterAdminLoginPage() {
  return (
    <div className="flex flex-col min-h-screen items-center justify-center bg-background p-4">
      <AdminLoginForm
        title="Master Admin"
        description="Sign in to manage Super Admins and everyone below."
        expectedTier="master_admin"
        redirectTo="/master-admin/dashboard"
      />
    </div>
  );
}
