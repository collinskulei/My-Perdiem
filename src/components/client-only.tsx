
"use client";

import { useState, useEffect, type ReactNode } from "react";

/**
 * A wrapper component that ensures its children are only rendered on the client side.
 * This is useful for preventing hydration mismatches with components that generate
 * unique IDs or rely on browser-specific APIs.
 * @param {object} props - The properties for the component.
 * @param {React.ReactNode} props.children - The child components to render on the client.
 * @returns {JSX.Element | null} The rendered children on the client, or null on the server.
 */
export function ClientOnly({ children }: { children: ReactNode }) {
  const [hasMounted, setHasMounted] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  if (!hasMounted) {
    return null;
  }

  return <>{children}</>;
}
