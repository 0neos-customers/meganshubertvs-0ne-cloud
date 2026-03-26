"use client";

import { useState, useEffect, type ReactNode } from "react";

/**
 * Only renders children on the app subdomain.
 * Returns null on marketing domains.
 * Uses NEXT_PUBLIC_APP_URL to determine the app hostname.
 */
export function AppOnly({ children }: { children: ReactNode }) {
  const [isApp, setIsApp] = useState(false);

  useEffect(() => {
    const appHostname = process.env.NEXT_PUBLIC_APP_URL
      ? new URL(process.env.NEXT_PUBLIC_APP_URL).hostname
      : 'localhost';
    setIsApp(window.location.hostname === appHostname || window.location.hostname === 'localhost');
  }, []);

  if (!isApp) return null;
  return <>{children}</>;
}
