import { describe, expect, it } from "vitest";
import { FREE_ENTITLEMENTS, resolveEntitlements } from "./resolve-entitlements";

describe("resolveEntitlements", () => {
  it("returns a complete, immutable copy of the canonical Free defaults", async () => {
    const snapshot = await resolveEntitlements("org-123");

    expect(snapshot).toEqual({
      coreFeaturesEnabled: true,
      maxTeams: null,
      maxApiKeys: 5,
      maxProjects: null,
      maxPromptVersionHistory: 20,
      ssoEnabled: false,
      auditRetentionDays: 7,
      prioritySupport: false,
      seatLimit: null,
      customBranding: false,
    });
    expect(snapshot).not.toBe(FREE_ENTITLEMENTS);
    expect(Object.isFrozen(snapshot)).toBe(true);
  });
});
