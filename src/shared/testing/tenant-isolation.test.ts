import { describe, expect, it } from "vitest";
import { assertCrossTenantDenied } from "./tenant-isolation";

describe("assertCrossTenantDenied", () => {
  const baseOpts = {
    actingAsOrg: "org-a",
    resourceOwnedByOrg: "org-b",
    resourceId: "resource-1",
  };

  it("passes when fetchResourceById throws", async () => {
    await expect(
      assertCrossTenantDenied({
        ...baseOpts,
        fetchResourceById: async () => {
          throw new Error("denied");
        },
      }),
    ).resolves.toBeUndefined();
  });

  it("passes when fetchResourceById resolves undefined", async () => {
    await expect(
      assertCrossTenantDenied({
        ...baseOpts,
        fetchResourceById: async () => undefined,
      }),
    ).resolves.toBeUndefined();
  });

  it("passes when fetchResourceById resolves an empty array (list-shaped denial)", async () => {
    await expect(
      assertCrossTenantDenied({
        ...baseOpts,
        fetchResourceById: async () => [],
      }),
    ).resolves.toBeUndefined();
  });

  it("fails, naming both organizations, when fetchResourceById resolves a truthy value", async () => {
    await expect(
      assertCrossTenantDenied({
        ...baseOpts,
        fetchResourceById: async () => ({ id: "resource-1" }),
      }),
    ).rejects.toThrow(/org-a.*org-b|org-b.*org-a/s);
  });
});
