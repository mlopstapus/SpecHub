import { Suspense, type ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AccessUnavailable } from "./access-unavailable";
import { AppNavigation } from "./_components/app-navigation";
import { AppShell } from "./_components/app-shell";
import { resolveAppShellAccess } from "./app-shell-access";

export default async function AuthenticatedAppLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const cookieHeader = (await headers()).get("cookie");
  const access = await resolveAppShellAccess(cookieHeader);

  if (access.status === "unauthenticated") {
    redirect("/login");
  }
  if (access.status === "entitlement-denied") {
    return <AccessUnavailable />;
  }
  return (
    <AppShell
      user={access.user}
      navigation={
        <Suspense
          fallback={
            <div
              aria-hidden="true"
              className="mx-5 my-6 h-40 animate-pulse rounded-lg bg-surface"
            />
          }
        >
          <AppNavigation teamId={access.user.teamId} />
        </Suspense>
      }
    >
      {children}
    </AppShell>
  );
}
