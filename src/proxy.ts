import { NextRequest, NextResponse } from "next/server";
import {
  resolveAppShellAccess,
  type AppShellAccess,
} from "./app/(app)/app-shell-access";

type AccessResolver = (cookieHeader: string | null) => Promise<AppShellAccess>;

export async function handleProtectedRequest(
  request: NextRequest,
  resolveAccess: AccessResolver = resolveAppShellAccess,
) {
  const access = await resolveAccess(request.headers.get("cookie"));

  if (access.status === "unauthenticated") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (access.status === "entitlement-denied") {
    return NextResponse.rewrite(new URL("/access-unavailable", request.url));
  }

  return NextResponse.next();
}

export async function proxy(request: NextRequest) {
  return handleProtectedRequest(request);
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/prompts/:path*",
    "/teams/:path*",
    "/workflows/:path*",
    "/projects/:path*",
    "/metrics/:path*",
    "/settings/:path*",
  ],
};
