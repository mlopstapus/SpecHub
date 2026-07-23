import { describe, expect, it } from "vitest";
import { EntitlementRequiredError } from "../domain/user";
import { assertCoreFeaturesEnabled } from "./entitlement-gate";

describe("assertCoreFeaturesEnabled", () => {
  it("does not throw while the hardcoded stand-in is enabled", () => {
    expect(() => assertCoreFeaturesEnabled()).not.toThrow();
  });

  it("throws EntitlementRequiredError when the stand-in is disabled", () => {
    expect(() => assertCoreFeaturesEnabled(false)).toThrow(
      EntitlementRequiredError,
    );
  });
});
