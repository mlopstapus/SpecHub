"use client";

import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { Navbar } from "@/components/navbar";

const PUBLIC_PATHS = ["/welcome", "/login", "/register", "/invite"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="h-8 w-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Public pages (login, register, invite) — no navbar
  if (isPublicPath(pathname)) {
    return <>{children}</>;
  }

  // Not authenticated — redirect to login
  if (!user) {
    if (typeof window !== "undefined") {
      window.location.href = "/welcome";
    }
    return null;
  }

  // Authenticated — show navbar + content
  return (
    <>
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </>
  );
}
