import { describe, expect, it } from "vitest";
import { getJwtExpiryHours, getJwtSecret } from "./index";

describe("getJwtSecret", () => {
  it("throws when the env var is missing", () => {
    expect(() => getJwtSecret({})).toThrow(/missing/i);
  });

  it("throws when the env var is empty", () => {
    expect(() => getJwtSecret({ JWT_SECRET: "" })).toThrow(/missing/i);
  });

  it("throws when the env var still equals the documented placeholder", () => {
    expect(() =>
      getJwtSecret({ JWT_SECRET: "REPLACE_ME_JWT_SECRET" }),
    ).toThrow(/placeholder/i);
  });

  it("returns the value when it is a real, non-placeholder secret", () => {
    expect(getJwtSecret({ JWT_SECRET: "a-real-signing-secret" })).toBe(
      "a-real-signing-secret",
    );
  });
});

describe("getJwtExpiryHours", () => {
  it("defaults to 24 when unset", () => {
    expect(getJwtExpiryHours({})).toBe(24);
  });

  it("returns a configured positive value", () => {
    expect(getJwtExpiryHours({ JWT_EXPIRY_HOURS: "48" })).toBe(48);
  });

  it("throws for a non-positive value", () => {
    expect(() => getJwtExpiryHours({ JWT_EXPIRY_HOURS: "0" })).toThrow();
    expect(() => getJwtExpiryHours({ JWT_EXPIRY_HOURS: "-1" })).toThrow();
  });
});
