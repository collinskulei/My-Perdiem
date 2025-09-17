/**
 * @file AdminLayout provides a consistent sidebar and header for all pages within the admin section.
 */
import { AdminLayoutClient } from './admin-layout';

/**
 * Defines the layout for the admin section, including a sidebar and main content area.
 * This is a Server Component that wraps the client-side layout structure.
 * @param {object} props - The properties for the component.
 * @param {React.ReactNode} props.children - The child components to be rendered within the main content area.
 * @returns {JSX.Element} The admin layout component.
 */
export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}