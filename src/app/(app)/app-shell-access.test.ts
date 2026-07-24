import { describe, expect, it, vi } from "vitest";
import type { AppSessionUser } from "@/bcs/identity-access";
import { resolveAppShellAccess } from "./app-shell-access";

const user: AppSessionUser = {
  id: "user-123",
  orgId: "org-123",
  teamId: "team-123",
  role: "admin",
  email: "jane@example.com",
  displayName: "Jane Doe",
  teamName: "Platform",
};

describe("resolveAppShellAccess", () => {
  it("returns unauthenticated without checking entitlements when no session resolves", async () => {
    const hasEntitlement = vi.fn();

    await expect(
      resolveAppShellAccess("cookie=value", {
        authenticateSession: vi.fn().mockResolvedValue(null),
        hasEntitlement,
      }),
    ).resolves.toEqual({ status: "unauthenticated" });
    expect(hasEntitlement).not.toHaveBeenCalled();
  });

  it("returns entitlement-denied while preserving the authenticated identity", async () => {
    await expect(
      resolveAppShellAccess("cookie=value", {
        authenticateSession: vi.fn().mockResolvedValue(user),
        hasEntitlement: vi.fn().mockResolvedValue(false),
      }),
    ).resolves.toEqual({ status: "entitlement-denied", user });
  });

  it("returns allowed for an active session with the core feature entitlement", async () => {
    const hasEntitlement = vi.fn().mockResolvedValue(true);

    await expect(
      resolveAppShellAccess("cookie=value", {
        authenticateSession: vi.fn().mockResolvedValue(user),
        hasEntitlement,
      }),
    ).resolves.toEqual({ status: "allowed", user });
    expect(hasEntitlement).toHaveBeenCalledWith(
      "org-123",
      "coreFeaturesEnabled",
    );
  });

  it("does not convert infrastructure failures into routine access denial", async () => {
    const error = new Error("database unavailable");

    await expect(
      resolveAppShellAccess("cookie=value", {
        authenticateSession: vi.fn().mockRejectedValue(error),
        hasEntitlement: vi.fn(),
      }),
    ).rejects.toBe(error);
  });
});
