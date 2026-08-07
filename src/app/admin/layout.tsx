/**
 * @file AdminLayout provides a consistent sidebar and header for all pages within the admin section.
 */
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { AdminLayoutClient } from './admin-layout';

/**
 * Defines the layout for the admin section, including a sidebar and main content area.
 * This is a Server Component that wraps the client-side layout structure.
 * Every request under /admin is gated here: no session, or a session whose
 * participant row is access_tier = 'client_user', gets redirected to login.
 * @param {object} props - The properties for the component.
 * @param {React.ReactNode} props.children - The child components to be rendered within the main content area.
 * @returns {JSX.Element} The admin layout component.
 */
export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/');
  }

  const { data: participant } = await supabase
    .from('participants')
    .select('access_tier')
    .eq('id', user.id)
    .single();

  if (!participant || participant.access_tier === 'client_user') {
    redirect('/');
  }

  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
