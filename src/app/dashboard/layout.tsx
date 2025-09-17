/**
 * @file DashboardLayout provides a consistent sidebar and header for all pages within the employee dashboard.
 */
import { EmployeeLayoutClient } from './employee-layout';

/**
 * Defines the layout for the employee dashboard, including a sidebar and main content area.
 * This is a Server Component that wraps the client-side layout structure.
 * @param {object} props - The properties for the component.
 * @param {React.ReactNode} props.children - The child components to be rendered within the main content area.
 * @returns {JSX.Element} The dashboard layout component.
 */
export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <EmployeeLayoutClient>{children}</EmployeeLayoutClient>;
}
