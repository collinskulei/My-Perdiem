/**
 * @file Server layouts shared by every portal's non-Per-Diem routes:
 * <portal>/home (overall Insights), <portal>/salary (Salary Payments) and
 * <portal>/hotels (Hotel Bookings) and <portal>/funding (Funding & Refunds).
 * Each route's own layout.tsx is a one-liner over these, so the three
 * portals can't drift apart. Same guard as the Per Diem dashboard
 * (resolvePortal, portal-access.ts); no per diem prefetch, since neither
 * page uses that dataset.
 */
import { AdminLayoutClient } from './admin-layout';
import { resolvePortal, requireModule, type PortalKind } from './portal-access';
import { homePath, modulePath } from '@/lib/modules';

export async function HomeModuleLayout({ kind, clientSlug, children }: {
  kind: PortalKind;
  clientSlug?: string;
  children: React.ReactNode;
}) {
  const { portal } = await resolvePortal(kind, clientSlug);
  return (
    <AdminLayoutClient basePath={homePath(portal.base)} loginPath={portal.loginPath} portalLabel={portal.label} portal={portal} activeModule="home">
      {children}
    </AdminLayoutClient>
  );
}

export async function SalaryModuleLayout({ kind, clientSlug, children }: {
  kind: PortalKind;
  clientSlug?: string;
  children: React.ReactNode;
}) {
  const { portal } = await resolvePortal(kind, clientSlug);
  requireModule(portal, 'salary');
  return (
    <AdminLayoutClient basePath={modulePath(portal.base, 'salary')} loginPath={portal.loginPath} portalLabel={portal.label} portal={portal} activeModule="salary">
      {children}
    </AdminLayoutClient>
  );
}

export async function HotelsModuleLayout({ kind, clientSlug, children }: {
  kind: PortalKind;
  clientSlug?: string;
  children: React.ReactNode;
}) {
  const { portal } = await resolvePortal(kind, clientSlug);
  requireModule(portal, 'hotels');
  return (
    <AdminLayoutClient basePath={modulePath(portal.base, 'hotels')} loginPath={portal.loginPath} portalLabel={portal.label} portal={portal} activeModule="hotels">
      {children}
    </AdminLayoutClient>
  );
}

export async function FundingModuleLayout({ kind, clientSlug, children }: {
  kind: PortalKind;
  clientSlug?: string;
  children: React.ReactNode;
}) {
  const { portal } = await resolvePortal(kind, clientSlug);
  requireModule(portal, 'funding');
  return (
    <AdminLayoutClient basePath={modulePath(portal.base, 'funding')} loginPath={portal.loginPath} portalLabel={portal.label} portal={portal} activeModule="funding">
      {children}
    </AdminLayoutClient>
  );
}
