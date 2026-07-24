import { describe, expect, it } from "vitest";
import { hasEntitlement } from "./has-entitlement";

describe("hasEntitlement", () => {
  it("returns true for the universally enabled core feature gate", async () => {
    await expect(
      hasEntitlement("org-123", "coreFeaturesEnabled"),
    ).resolves.toBe(true);
  });

  it("returns false for a disabled boolean entitlement", async () => {
    await expect(hasEntitlement("org-123", "ssoEnabled")).resolves.toBe(false);
  });

  it("returns true for unlimited numeric entitlements and false for zero limits", async () => {
    await expect(hasEntitlement("org-123", "maxTeams")).resolves.toBe(true);
    await expect(
      hasEntitlement("org-123", "maxPromptVersionHistory"),
    ).resolves.toBe(true);
  });
});
